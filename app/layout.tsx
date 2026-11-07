import type { Metadata } from 'next';
import './globals.css';
import { WalletProvider } from '../components/WalletContext';
import { Shell } from '../components/Shell';
export const metadata:Metadata={title:'RomeID — Cross-VM Identity Manager',description:'One identity, two wallets, one shared on-chain state on Rome Hadrian.'};
export default function Layout({children}:{children:React.ReactNode}) {return <html lang="en"><body><WalletProvider><Shell>{children}</Shell></WalletProvider></body></html>;}
