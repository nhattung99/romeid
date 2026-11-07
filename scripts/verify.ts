import 'dotenv/config';
import { checkDeployment,config } from '../lib/rome/client';
await checkDeployment();
console.log(JSON.stringify({chainId:config.chainId,address:config.identityAddress,codePresent:true,note:'Read-only preflight. Does not establish dual-lane parity.'},null,2));
