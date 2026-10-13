import "server-only";
import type { ChatMessage, AgentBlock } from "./protocol";
import { AGENT_TOOLS } from "./tools";
export async function openAIChat(history:ChatMessage[], instructions:string):Promise<AgentBlock[]> {
 const messages: Record<string,unknown>[]=[{role:"system",content:instructions}];
 for(const m of history) {
 if(typeof m.content==="string"){messages.push({role:m.role,content:m.content});continue;}
 if(m.role==="assistant") {const texts=m.content.filter(b=>b.type==="text").map(b=>b.text).join("\n");const calls=m.content.filter(b=>b.type==="tool_use").map(b=>({id:b.id,type:"function",function:{name:b.name,arguments:JSON.stringify(b.input)}}));messages.push({role:"assistant",content:texts||null,...(calls.length?{tool_calls:calls}:{})});}
 else {for(const b of m.content) {if(b.type==="text")messages.push({role:"user",content:b.text});else messages.push({role:"tool",tool_call_id:b.tool_use_id,content:b.content});}}
 }
 const res=await fetch("https://api.openai.com/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.OPENAI_CHAT_MODEL||"gpt-4.1",messages,tools:AGENT_TOOLS.map(t=>({type:"function",function:t})),max_tokens:1200}),signal:AbortSignal.timeout(45000)});
 if(!res.ok)throw new Error(`Chat provider returned ${res.status}`);
 const data=await res.json();const m=data.choices?.[0]?.message; if(!m)throw new Error("Empty response");const blocks:AgentBlock[]=[];if(m.content)blocks.push({type:"text",text:m.content});for(const c of m.tool_calls??[])blocks.push({type:"tool_use",id:c.id,name:c.function.name,input:JSON.parse(c.function.arguments)});return blocks;
}
