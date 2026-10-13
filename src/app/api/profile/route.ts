import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { profile, saveProfile } from "@/lib/diner-profile";
import { getSupabase } from "@/lib/supabase";
export async function GET() {
 try { const p=await profile(true); const db=getSupabase(); const history=db ? await db.from("orders").select("id,restaurant_id,items,created_at").eq("diner_id",p!.id).order("created_at",{ascending:false}).limit(20) : {data:[]}; return Response.json({preferences:p!.preferences,linked:!!p!.phone,orders:history.data ?? []},{headers:{"Cache-Control":"no-store"}}); } catch { return Response.json({error:"Memory is unavailable. You can still order."},{status:503}); }
}
export async function POST(request:Request) {
 try {
 const p=await profile(true); if(!p) throw new Error(); const raw=await request.text(); if(raw.length>4000) return Response.json({error:"Request too large"},{status:400}); const b=JSON.parse(raw); const db=getSupabase();
 if(b.action==="delete_order" && typeof b.id==="string") { if(db) {const {error}=await db.from("orders").update({diner_id:null}).eq("id",b.id).eq("diner_id",p.id); if(error) throw error;} }
 else if(b.action==="delete") {p.preferences=p.preferences.filter(x=>x.id!==b.id);await saveProfile(p);}
 else if(b.action==="link") {
 const phone=String(b.phone??"").replace(/[\s()-]/g,""); if(!/^\+?[0-9]{8,15}$/.test(phone)) return Response.json({error:"Enter your phone with country code."},{status:400}); if(!db) return Response.json({error:"Phone linking requires the database."},{status:503});
 const {data:existing,error}=await db.from("diner_profiles").select("id,preferences").eq("phone",phone).maybeSingle();if(error)throw error;
 if(existing && existing.id!==p.id) { const merged=[...existing.preferences,...p.preferences].filter((x,i,a)=>a.findIndex(y=>y.kind===x.kind&&y.value.toLowerCase()===x.value.toLowerCase())===i).slice(0,50); await saveProfile({id:existing.id,phone,preferences:merged}); const jar=await cookies();jar.set("grub_diner",existing.id,{httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:31536000}); }
 else {p.phone=phone;await saveProfile(p);}
 } else if(b.action==="save") {
 if(!["allergy","diet","like"].includes(b.kind)||typeof b.value!=="string"||!b.value.trim()||b.value.length>120) return Response.json({error:"Invalid preference"},{status:400});
 if(b.kind!=="like" && b.confirmed!==true)return Response.json({error:"Please confirm this allergy or diet first."},{status:400});
 if(!p.preferences.some(x=>x.kind===b.kind&&x.value.toLowerCase()===b.value.trim().toLowerCase())) p.preferences.push({id:randomUUID(),kind:b.kind,value:b.value.trim()});p.preferences=p.preferences.slice(-50);await saveProfile(p);
 } else return Response.json({error:"Invalid action"},{status:400});
 return GET();
 } catch { return Response.json({error:"Could not update memory. Please try again."},{status:500}); }
}
