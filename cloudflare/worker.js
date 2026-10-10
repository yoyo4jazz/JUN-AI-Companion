const ORIGIN = "https://yoyo4jazz.github.io";
const cors = {
  "Access-Control-Allow-Origin": ORIGIN,
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Vary": "Origin"
};
const json = (value, status=200) => Response.json(value,{status,headers:cors});
export default {
 async fetch(request, env) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") return new Response(null,{status:204,headers:cors});
  if (url.pathname === "/health" && request.method === "GET") return json({ok:true,service:"JUN Companion Cloudflare Worker"});
  if (url.pathname !== "/session" || request.method !== "POST") return json({error:"Not found"},404);
  if (request.headers.get("Origin") !== ORIGIN) return json({error:"Origin not allowed"},403);
  if (!env.OPENAI_API_KEY) return json({error:"Server belum memiliki OPENAI_API_KEY"},503);
  let body;
  try {body=await request.json()}catch{return json({error:"JSON invalid"},400)}
  if(typeof body?.sdp!=="string" || body.sdp.length>150000) return json({error:"SDP invalid"},400);
  const session={
   type:"realtime",model:"gpt-realtime",
   instructions:"Kamu Jun, asisten AI perempuan berbahasa Indonesia yang hangat, natural, membantu, dan jujur. Jawab ringkas. Jangan mengaku manusia.",
   audio:{output:{voice:"marin"}}
  };
  const form=new FormData();form.set("sdp",body.sdp);form.set("session",JSON.stringify(session));
  try {
   const response=await fetch("https://api.openai.com/v1/realtime/calls",{
    method:"POST",headers:{"Authorization":"Bearer "+env.OPENAI_API_KEY},body:form
   });
   if(!response.ok){console.error("OpenAI Realtime returned",response.status);return json({error:"Gagal membuat sesi Realtime",status:response.status},502)}
   return new Response(response.body,{status:200,headers:{...cors,"Content-Type":"application/sdp"}});
  }catch(e){console.error("Realtime connection error",e);return json({error:"Server gagal terhubung ke layanan AI"},502)}
 }
};