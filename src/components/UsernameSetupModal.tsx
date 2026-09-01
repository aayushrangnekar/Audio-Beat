import React, { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { UserIcon } from "lucide-react";

interface Props { open: boolean; onSave: (username: string) => void; }

export function UsernameSetupModal({ open, onSave }: Props) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) { setName(""); return; }
    const timer = window.setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 450);
    return () => window.clearTimeout(timer);
  }, [open]);

  const trimmedName = name.trim();
  const canContinue = trimmedName.length > 0;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (canContinue) onSave(trimmedName);
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div className="fixed inset-0 z-[60] overflow-y-auto bg-[#070712]" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} role="dialog" aria-modal="true" aria-labelledby="username-setup-title">
          <div className="relative flex min-h-full flex-col overflow-hidden px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(3rem+env(safe-area-inset-top))]">
            <div className="pointer-events-none absolute inset-0" style={{background:"radial-gradient(circle at 50% 22%, rgba(199,72,255,.20), transparent 30%), radial-gradient(circle at 18% 78%, rgba(255,65,167,.12), transparent 28%), radial-gradient(circle at 84% 75%, rgba(80,93,255,.14), transparent 28%)"}} />
            <motion.div className="relative z-10 mx-auto flex w-full max-w-sm flex-1 flex-col justify-center" initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} transition={{duration:.55,ease:[.22,1,.36,1]}}>
              <div className="relative mx-auto flex h-28 w-28 items-center justify-center">
                <motion.div className="absolute inset-2 rounded-full border border-fuchsia-400/30" animate={{scale:[.92,1.08,.92],opacity:[.35,.8,.35]}} transition={{duration:2.6,repeat:Infinity,ease:"easeInOut"}} />
                <div className="absolute inset-5 rounded-full bg-fuchsia-500/20 blur-xl" />
                <img src="/audio-beat-logo.svg" alt="Audio Beat" className="relative h-20 w-20 drop-shadow-[0_0_24px_rgba(214,82,255,.55)]" />
              </div>
              <h2 id="username-setup-title" className="mt-7 text-center text-3xl font-extrabold tracking-tight text-white">Welcome!</h2>
              <p className="mt-2 text-center text-base text-white/55">Let&apos;s get to know you</p>
              <form onSubmit={handleSubmit} className="mt-9">
                <label htmlFor="username-setup-input" className="sr-only">Your name</label>
                <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.055] px-4 shadow-[0_16px_45px_rgba(0,0,0,.28)] transition focus-within:border-fuchsia-400/60">
                  <UserIcon size={21} className="text-fuchsia-300" />
                  <input ref={inputRef} id="username-setup-input" autoComplete="name" value={name} onChange={(e)=>setName(e.target.value)} placeholder="Enter your name" maxLength={40} className="min-w-0 flex-1 bg-transparent py-4 text-base font-semibold text-white outline-none placeholder:text-white/30" />
                </div>
                <motion.button type="submit" disabled={!canContinue} whileTap={canContinue?{scale:.98}:undefined} className="mt-5 w-full rounded-2xl bg-gradient-to-r from-pink-500 via-fuchsia-500 to-indigo-500 px-6 py-4 text-sm font-extrabold text-white shadow-[0_12px_35px_rgba(194,64,255,.25)] disabled:opacity-35">Continue</motion.button>
              </form>
              <p className="mt-6 text-center text-xs leading-5 text-white/35">This name is stored only on this device. You can change it later.</p>
            </motion.div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
