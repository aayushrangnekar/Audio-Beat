import React from "react";
import { motion } from "framer-motion";

export function LaunchScreen() {
  return (
    <motion.div className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#060610]" initial={{opacity:1}} animate={{opacity:1}} exit={{opacity:0,scale:1.035,filter:"blur(5px)"}} transition={{duration:.5}} aria-label="Audio Beat is opening">
      <div className="pointer-events-none absolute inset-0" style={{background:"radial-gradient(circle at 50% 45%, rgba(207,69,255,.18), transparent 31%), radial-gradient(circle at 45% 58%, rgba(255,54,157,.09), transparent 35%), radial-gradient(circle at 56% 60%, rgba(75,86,255,.10), transparent 35%)"}} />
      <div className="relative flex flex-col items-center">
        <div className="relative flex h-52 w-52 items-center justify-center">
          {[0,1,2].map((ring)=><motion.div key={ring} className="absolute h-[70px] w-[70px] rounded-full border border-fuchsia-400/40" initial={{opacity:0,scale:.72}} animate={{opacity:[0,.65,0],scale:[.75,1.8+ring*.45,2.15+ring*.5]}} transition={{delay:.25+ring*.22,duration:1.45,ease:"easeOut"}} />)}
          <motion.div className="absolute h-28 w-28 rounded-full bg-fuchsia-500/25 blur-2xl" initial={{opacity:0,scale:.7}} animate={{opacity:[0,.8,.45],scale:[.7,1.25,1]}} transition={{duration:1.25}} />
          <motion.img src="/audio-beat-logo.svg" alt="" className="relative h-28 w-28 drop-shadow-[0_0_30px_rgba(214,82,255,.72)]" initial={{opacity:0,scale:.55,rotate:-7}} animate={{opacity:1,scale:[.55,1.08,1],rotate:[-7,2,0]}} transition={{duration:1,ease:[.22,1,.36,1]}} />
        </div>
        <motion.h1 className="-mt-3 bg-gradient-to-r from-indigo-300 via-fuchsia-300 to-pink-300 bg-clip-text text-4xl font-black tracking-tight text-transparent" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{delay:.6,duration:.7}}>Audio Beat</motion.h1>
        <motion.p className="mt-3 text-sm font-medium tracking-wide text-white/38" initial={{opacity:0}} animate={{opacity:1}} transition={{delay:1,duration:.55}}>Feel every beat</motion.p>
      </div>
    </motion.div>
  );
}
