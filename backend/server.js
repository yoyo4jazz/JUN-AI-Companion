import express from "express";
import cors from "cors";
import "dotenv/config";
const app=express();
const origins=(process.env.ALLOWED_ORIGIN||"https://yoyo4jazz.github.io").split(",").map(s=>s.trim());
app.use(cors({origin:origins}));
app.use(express.json({limit:"1mb"}));
app.get("/health",(_,res)=>res.json({ok:true,service:"JUN Companion voice bridge"}));
app.post("/session",async(req,res)=>{
 if(!process.env.OPENAI_API_KEY)return res.status(503).json({error:"OPENAI_API_KEY belum disetel di server"});
 if(typeof req.body?.sdp!=="string"||req.body.sdp.length>150000)return res.status(400).json({error:"SDP tidak valid"});
 const session={type:"realtime",model:"gpt-realtime",instructions:"Kamu adalah Jun, asisten AI perempuan berbahasa Indonesia yang hangat, cerdas, santai, membantu pekerjaan dan percakapan. Jangan mengaku manusia. Jawab ringkas dan natural.",audio:{output:{voice:"marin"}}};
 try{
 const form=new FormData();form.set("sdp",req.body.sdp);form.set("session",JSON.stringify(session));
 const r=await fetch("https://api.openai.com/v1/realtime/calls",{method:"POST",headers:{Authorization:"Bearer "+process.env.OPENAI_API_KEY},body:form});
 const body=await r.text();if(!r.ok)return res.status(502).json({error:"OpenAI gagal membuat sesi",detail:body.slice(0,400)});
 res.type("application/sdp").send(body);
 }catch(e){res.status(502).json({error:"Koneksi server gagal",detail:e.message})}
});
app.listen(process.env.PORT||3000,()=>console.log("JUN voice bridge ready"));
