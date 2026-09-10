import { motion, AnimatePresence, useReducedMotion, useMotionValue, useSpring, useTransform } from "motion/react";
import { useEffect } from "react";

export { motion, AnimatePresence };

const spring = { type: "spring", stiffness: 380, damping: 32, mass: 0.8 };
const soft = { type: "spring", stiffness: 220, damping: 28 };

/** Page-level wrapper: one orchestrated reveal on mount, then quiet. */
export function Page({ children, className = "" }) {
  const reduce = useReducedMotion();
  return (
    <motion.main
      className={className}
      initial={reduce ? false : "hidden"}
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } } }}
    >
      {children}
    </motion.main>
  );
}

/** A child of <Page> that takes part in the stagger. */
export const Reveal = ({ children, className = "", as: Tag = "div", ...rest }) => {
  const M = motion[Tag] || motion.div;
  return (
    <M
      className={className}
      variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: soft } }}
      {...rest}
    >
      {children}
    </M>
  );
};

/** Primary surface. `raised` adds the elevation shadow. */
export function Card({ children, className = "", raised = true, ...rest }) {
  return (
    <Reveal as="section" className={`card ${raised ? "card-raised" : ""} ${className}`} {...rest}>
      {children}
    </Reveal>
  );
}

/** Button with press feedback. Variants: primary | ghost | danger | quiet */
export function Button({ children, variant = "primary", className = "", ...rest }) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      className={`btn btn-${variant} ${className}`}
      whileTap={reduce ? undefined : { scale: 0.97 }}
      transition={spring}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

/** Modal with backdrop; enters with a spring, exits quickly. */
export function Modal({ open, onClose, children, width = 420 }) {
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-overlay" onClick={onClose}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          <motion.div className="modal-card" style={{ maxWidth: width }} onClick={(e) => e.stopPropagation()}
            role="dialog" aria-modal="true"
            initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 8, transition: { duration: 0.14 } }}
            transition={spring}>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Animated number for stats (counts up from previous value). */
export function Counter({ value, prefix = "", suffix = "", decimals = 0 }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(0);
  const sp = useSpring(mv, { stiffness: 90, damping: 22 });
  const txt = useTransform(sp, (v) => `${prefix}${Number(v).toFixed(decimals)}${suffix}`);
  useEffect(() => { reduce ? sp.jump(value) : mv.set(value); }, [value, mv, sp, reduce]);
  return <motion.span>{txt}</motion.span>;
}

/** Layout-animated list: rows glide when order/status changes. */
export const List = ({ children, className = "" }) => <motion.div layout className={className}>{children}</motion.div>;
export const Row = ({ children, className = "", ...rest }) => (
  <motion.div layout className={className} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={soft} {...rest}>
    {children}
  </motion.div>
);

export const springs = { spring, soft };