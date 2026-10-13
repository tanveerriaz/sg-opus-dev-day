import Image from "next/image";
import Link from "next/link";
export function Brand(){return <div className="border-b border-line bg-canvas"><Link href="/" className="mx-auto flex h-[76px] max-w-xl items-center gap-2 px-4 text-xl font-bold text-action"><Image src="/grub-bear.png" alt="" width={44} height={44} className="m-2 object-contain" priority/>Grub<span className="ml-auto text-xs font-normal text-muted">Your dining companion</span></Link></div>;}
