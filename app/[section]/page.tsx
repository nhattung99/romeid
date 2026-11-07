import { notFound } from 'next/navigation';
import { Workspace } from '../../components/Workspace';
const sections=['dashboard','create','link','explorer','settings','about'];
export function generateStaticParams(){return sections.map(section=>({section}));}
export default async function Page({params}:{params:Promise<{section:string}>}){const {section}=await params;if(!sections.includes(section))notFound();return <Workspace section={section}/>;}
