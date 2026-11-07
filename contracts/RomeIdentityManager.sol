// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice Public identity registry. No custody, external calls, attestator or upgrade key.
/// Solana keys are authenticated by Rome's transaction runtime, never by an address string.
contract RomeIdentityManager {
    uint256 public constant RECOVERY_DELAY = 2 days;
    uint256 public constant MAX_WALLETS = 16;
    struct Wallet { uint8 kind; bytes32 key; address sender; }
    struct Identity { address owner; string metadataURI; uint256 epoch; address guardian; address guardianOffer; address successor; uint256 transferDeadline; uint256 recoveryAt; }
    struct Offer { uint256 nonce; uint256 deadline; uint256 epoch; }
    uint256 public nextIdentityId = 1;
    uint256 public nextNonce = 1;
    mapping(uint256 => Identity) private identities;
    mapping(uint256 => Wallet[]) private wallets;
    mapping(address => uint256) public identityOf;
    mapping(bytes32 => uint256) public identityOfKey;
    mapping(uint256 => mapping(bytes32 => Offer)) public linkOffers;
    error Unauthorized(); error Invalid(); error Duplicate(); error Expired(); error Stale();
    event IdentityCreated(uint256 indexed id, address indexed owner, string metadataURI);
    event WalletLinkProposed(uint256 indexed id, bytes32 indexed walletId, uint256 nonce, uint256 deadline);
    event WalletLinked(uint256 indexed id, address indexed sender, uint8 kind, bytes32 key);
    event WalletUnlinked(uint256 indexed id, address indexed sender);
    event ProfileUpdated(uint256 indexed id, address indexed actor, string metadataURI);
    event TransferProposed(uint256 indexed id, address indexed successor, uint256 deadline);
    event OwnershipTransferred(uint256 indexed id, address indexed previousOwner, address indexed newOwner);
    event GuardianProposed(uint256 indexed id, address indexed guardian);
    event GuardianChanged(uint256 indexed id, address indexed guardian);
    event RecoveryScheduled(uint256 indexed id, address indexed guardian, uint256 readyAt);
    event RecoveryCancelled(uint256 indexed id);
    modifier onlyOwner(uint256 id) { if (identities[id].owner != msg.sender) revert Unauthorized(); _; }
    function walletId(uint8 kind, bytes32 key) public pure returns(bytes32) { return keccak256(abi.encode(kind, key)); }
    function senderFor(uint8 kind, bytes32 key) public pure returns(address) {
        if (key == bytes32(0)) revert Invalid();
        if (kind == 0) { if (uint256(key) >> 160 != 0) revert Invalid(); return address(uint160(uint256(key))); }
        if (kind == 1) return address(uint160(uint256(keccak256(abi.encodePacked(key)))));
        revert Invalid();
    }
    function createIdentity(uint8 kind, bytes32 key, string calldata uri) external returns(uint256 id) {
        if (senderFor(kind,key) != msg.sender) revert Unauthorized();
        _uri(uri);
        id = nextIdentityId++;
        identities[id].owner = msg.sender; identities[id].metadataURI = uri; identities[id].epoch = 1;
        _link(id, kind, key);
        emit IdentityCreated(id,msg.sender,uri);
    }
    function proposeLink(uint256 id, uint8 kind, bytes32 key, uint256 deadline) external onlyOwner(id) returns(uint256 nonce) {
        address sender = senderFor(kind,key); _deadline(deadline);
        if (identityOf[sender] != 0 || identityOfKey[walletId(kind,key)] != 0) revert Duplicate();
        nonce = nextNonce++;
        linkOffers[id][walletId(kind,key)] = Offer(nonce,deadline,identities[id].epoch);
        emit WalletLinkProposed(id,walletId(kind,key),nonce,deadline);
    }
    function cancelLink(uint256 id, uint8 kind, bytes32 key) external onlyOwner(id) { delete linkOffers[id][walletId(kind,key)]; }
    function acceptLink(uint256 id, uint8 kind, bytes32 key, uint256 nonce) external {
        if (senderFor(kind,key) != msg.sender) revert Unauthorized();
        bytes32 wid = walletId(kind,key); Offer memory offer = linkOffers[id][wid];
        if (offer.nonce == 0 || offer.nonce != nonce || offer.epoch != identities[id].epoch) revert Stale();
        if (block.timestamp > offer.deadline) revert Expired();
        delete linkOffers[id][wid]; _link(id,kind,key);
    }
    function unlinkWallet(uint256 id, address sender) external {
        Identity storage p = identities[id];
        if (msg.sender != p.owner && !(msg.sender == sender && identityOf[msg.sender] == id)) revert Unauthorized();
        if (sender == p.owner || identityOf[sender] != id) revert Invalid();
        Wallet[] storage ws = wallets[id];
        for(uint256 i; i < ws.length; ++i) if(ws[i].sender == sender) {
            delete identityOfKey[walletId(ws[i].kind,ws[i].key)]; delete identityOf[sender];
            ws[i] = ws[ws.length-1]; ws.pop(); break;
        }
        if (sender == p.guardian) { p.guardian = address(0); p.recoveryAt = 0; emit GuardianChanged(id,address(0)); }
        if (sender == p.guardianOffer) p.guardianOffer = address(0);
        if (sender == p.successor) { p.successor = address(0); p.transferDeadline = 0; }
        emit WalletUnlinked(id,sender);
    }
    function updateProfile(uint256 id, string calldata uri) external {
        if (id == 0 || identityOf[msg.sender] != id) revert Unauthorized();
        _uri(uri); identities[id].metadataURI = uri; emit ProfileUpdated(id,msg.sender,uri);
    }
    function proposeTransfer(uint256 id, address successor, uint256 deadline) external onlyOwner(id) {
        _linkedOther(id,successor); _deadline(deadline);
        identities[id].successor = successor; identities[id].transferDeadline = deadline;
        emit TransferProposed(id,successor,deadline);
    }
    function cancelTransfer(uint256 id) external onlyOwner(id) { identities[id].successor = address(0); identities[id].transferDeadline = 0; }
    function acceptTransfer(uint256 id) external {
        Identity storage p = identities[id];
        if(p.successor != msg.sender || identityOf[msg.sender] != id) revert Unauthorized();
        if(block.timestamp > p.transferDeadline) revert Expired();
        _rotate(id,msg.sender);
    }
    function proposeGuardian(uint256 id, address guardian) external onlyOwner(id) {
        if(guardian != address(0)) _linkedOther(id,guardian);
        identities[id].guardianOffer = guardian;
        if(guardian == address(0)) { identities[id].guardian = address(0); identities[id].recoveryAt = 0; emit GuardianChanged(id,address(0)); }
        emit GuardianProposed(id,guardian);
    }
    function acceptGuardian(uint256 id) external {
        Identity storage p = identities[id];
        if(p.guardianOffer != msg.sender || identityOf[msg.sender] != id) revert Unauthorized();
        p.guardian = msg.sender; p.guardianOffer = address(0); p.recoveryAt = 0;
        emit GuardianChanged(id,msg.sender);
    }
    function scheduleRecovery(uint256 id) external {
        Identity storage p = identities[id];
        if(p.guardian != msg.sender || p.recoveryAt != 0) revert Unauthorized();
        p.recoveryAt = block.timestamp + RECOVERY_DELAY; emit RecoveryScheduled(id,msg.sender,p.recoveryAt);
    }
    function cancelRecovery(uint256 id) external onlyOwner(id) { identities[id].recoveryAt = 0; emit RecoveryCancelled(id); }
    function executeRecovery(uint256 id) external {
        Identity storage p = identities[id];
        if(p.guardian != msg.sender || identityOf[msg.sender] != id) revert Unauthorized();
        if(p.recoveryAt == 0 || block.timestamp < p.recoveryAt) revert Invalid();
        _rotate(id,msg.sender);
    }
    function getIdentity(uint256 id) external view returns(Identity memory profile, Wallet[] memory linked) { return (identities[id],wallets[id]); }
    function _link(uint256 id, uint8 kind, bytes32 key) private {
        address sender = senderFor(kind,key); bytes32 wid = walletId(kind,key);
        if(identityOf[sender] != 0 || identityOfKey[wid] != 0) revert Duplicate();
        if(wallets[id].length >= MAX_WALLETS) revert Invalid();
        wallets[id].push(Wallet(kind,key,sender)); identityOf[sender] = id; identityOfKey[wid] = id;
        emit WalletLinked(id,sender,kind,key);
    }
    function _rotate(uint256 id, address successor) private {
        Identity storage p = identities[id]; address previous = p.owner;
        Wallet[] storage ws = wallets[id]; Wallet memory kept;
        for(uint256 i; i < ws.length; ++i) {
            if(ws[i].sender == successor) kept = ws[i];
            else { delete identityOf[ws[i].sender]; delete identityOfKey[walletId(ws[i].kind,ws[i].key)]; emit WalletUnlinked(id,ws[i].sender); }
        }
        if(kept.sender == address(0)) revert Invalid();
        delete wallets[id]; wallets[id].push(kept);
        p.owner = successor; p.epoch++; p.guardian = address(0); p.guardianOffer = address(0);
        p.successor = address(0); p.transferDeadline = 0; p.recoveryAt = 0;
        emit OwnershipTransferred(id,previous,successor);
    }
    function _linkedOther(uint256 id, address who) private view { if(who == address(0) || who == identities[id].owner || identityOf[who] != id) revert Invalid(); }
    function _deadline(uint256 value) private view { if(value <= block.timestamp || value > block.timestamp + 1 days) revert Invalid(); }
    function _uri(string calldata uri) private pure { if(bytes(uri).length == 0 || bytes(uri).length > 512) revert Invalid(); }
}
