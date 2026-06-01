'use client';

// RowMenu — popover menu for table-row actions.
//
// Tables in the app use `overflow-x-auto` so wide tables can scroll
// horizontally. That wrapper creates a clipping container — any
// position:absolute descendant gets cut off at the wrapper's edge, so
// dropdown menus rendered directly inside `<td>` would visually disappear
// regardless of z-index.
//
// This component renders the menu into a React Portal at document.body
// and positions it relative to the trigger via getBoundingClientRect.
// That escapes the table's overflow context entirely.
//
// Props:
//   trigger  — required ReactNode for the button. Defaults to a
//              MoreVertical icon button.
//   children — menu content (rendered inside the popover panel)
//   align    — 'right' | 'left' (default 'right'); which edge of the
//              trigger the menu lines up against
//   width    — Tailwind width class for the panel (default 'w-56')
//   onOpen   — optional callback fired when the menu opens
//
// Children can call the `close` helper from useRowMenuClose() to dismiss
// the menu after a click. Or they can use plain onClick handlers — the
// menu also closes on any click of a button/anchor descendant via the
// onClickCapture handler at the panel root.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical } from 'lucide-react';

const RowMenuContext = createContext({ close: () => {} });

export function useRowMenuClose() {
  return useContext(RowMenuContext).close;
}

export default function RowMenu({
  trigger,
  children,
  align = 'right',
  width = 'w-56',
  onOpen,
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const panelRef = useRef(null);

  const close = useCallback(() => setOpen(false), []);
  const toggle = useCallback(() => {
    setOpen((v) => {
      const next = !v;
      if (next && typeof onOpen === 'function') onOpen();
      return next;
    });
  }, [onOpen]);

  // Position the panel under (and aligned to) the trigger. Re-runs on
  // open + on scroll/resize so the menu tracks the row when the user
  // scrolls inside or outside the table.
  const reposition = useCallback(() => {
    if (!buttonRef.current) return;
    const r = buttonRef.current.getBoundingClientRect();
    // Panel width estimate — Tailwind w-56 is 14rem ≈ 224px. Good enough
    // for an alignment heuristic; the real width is whatever Tailwind
    // applies.
    const PANEL_W = 224;
    const top = r.bottom + 4;
    const left = align === 'right' ? r.right - PANEL_W : r.left;
    setPos({ top, left });
  }, [align]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    reposition();
    const onScroll = () => reposition();
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open, reposition]);

  // Click-outside + Escape to close.
  useEffect(() => {
    if (!open) return undefined;
    function onClick(e) {
      const inButton =
        buttonRef.current && buttonRef.current.contains(e.target);
      const inPanel = panelRef.current && panelRef.current.contains(e.target);
      if (!inButton && !inPanel) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const defaultTrigger = (
    <button
      type="button"
      aria-haspopup="menu"
      aria-expanded={open}
      aria-label="Open menu"
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 transition hover:border-amber-300 hover:bg-slate-50"
    >
      <MoreVertical size={16} />
    </button>
  );

  const triggerNode = trigger || defaultTrigger;

  return (
    <>
      <span
        ref={buttonRef}
        onClick={toggle}
        className="inline-block"
      >
        {triggerNode}
      </span>
      {open &&
        typeof document !== 'undefined' &&
        createPortal(
          <RowMenuContext.Provider value={{ close }}>
            <div
              ref={panelRef}
              role="menu"
              // z-[1000] keeps the menu above tabbed sidebars, modals
              // headers, and the Header's sticky bar (z-50).
              className={`fixed z-[1000] ${width} overflow-hidden rounded-lg border border-slate-200 bg-white shadow-card-lg`}
              style={{ top: pos.top, left: Math.max(8, pos.left) }}
              onClick={(e) => {
                // BUBBLE phase — runs AFTER the clicked button's own
                // onClick. A nested submenu trigger can call
                // e.stopPropagation() in its handler to prevent reaching
                // this listener; everything else auto-closes.
                const t = e.target.closest('button, a');
                if (t && t !== panelRef.current) close();
              }}
            >
              {children}
            </div>
          </RowMenuContext.Provider>,
          document.body
        )}
    </>
  );
}
