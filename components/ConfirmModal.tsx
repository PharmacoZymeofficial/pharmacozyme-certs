"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
} from "react";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

interface ConfirmContextType {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextType | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{
    opts: ConfirmOptions;
    resolve: (v: boolean) => void;
  } | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setState({ opts, resolve })),
    []
  );

  const close = (result: boolean) => {
    state?.resolve(result);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      {state && (
        <div
          className="fixed inset-0 z-[9998] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          style={{ animation: "fadeIn 0.15s ease" }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6"
            style={{
              animation: "popIn 0.2s cubic-bezier(0.34,1.56,0.64,1)",
            }}
          >
            {state.opts.title && (
              <div className="flex items-center gap-3 mb-3">
                <span
                  className={`material-symbols-outlined text-2xl ${
                    state.opts.danger ? "text-red-500" : "text-brand-vivid-green"
                  }`}
                >
                  {state.opts.danger ? "warning" : "help"}
                </span>
                <h3 className="text-lg font-bold text-brand-dark-green">
                  {state.opts.title}
                </h3>
              </div>
            )}
            <p className="text-sm text-on-surface-variant mb-6 leading-relaxed">
              {state.opts.message}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => close(false)}
                className="px-5 py-2.5 text-sm font-semibold text-on-surface-variant hover:bg-gray-100 rounded-xl transition-colors"
              >
                {state.opts.cancelText ?? "Cancel"}
              </button>
              <button
                onClick={() => close(true)}
                className={`px-5 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors ${
                  state.opts.danger
                    ? "bg-red-500 hover:bg-red-600"
                    : "vivid-gradient-cta"
                }`}
              >
                {state.opts.confirmText ?? "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`
        @keyframes fadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes popIn  {
          from { opacity:0; transform:scale(0.85) translateY(10px) }
          to   { opacity:1; transform:scale(1)    translateY(0)    }
        }
      `}</style>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be inside ConfirmProvider");
  return ctx.confirm;
}
