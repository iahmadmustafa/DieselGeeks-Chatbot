import * as React from "react";
import { createPortal } from "react-dom";

import { loginWithGoogle, loginWithPassword, type WpIdentityResult } from "../wp-identity";
import { CloseIcon } from "./Icons";

type SubmitStatus = "idle" | "submitting" | "google";

interface LoginModalProps {
  onClose: () => void;
  onSuccess: (identity: WpIdentityResult) => void;
}

/**
 * In-widget WordPress login. Password → wp_signon AJAX. Google → Google
 * Identity Services on this page (same Client ID as Site Kit) + WP token
 * verify — stays on the chat; never redirects to /my-account/.
 */
export function LoginModal({ onClose, onSuccess }: LoginModalProps) {
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [remember, setRemember] = React.useState(true);
  const [status, setStatus] = React.useState<SubmitStatus>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const markerRef = React.useRef<HTMLSpanElement | null>(null);
  const [portalTarget, setPortalTarget] = React.useState<Element | null>(null);
  const googleAbortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    const marker = markerRef.current;
    if (!marker) {
      return;
    }
    const root = marker.getRootNode();
    if (root instanceof ShadowRoot) {
      setPortalTarget(root.querySelector(".dg-root") ?? root.firstElementChild);
    } else {
      setPortalTarget(document.body);
    }
  }, []);

  React.useEffect(() => {
    return () => {
      googleAbortRef.current?.abort();
    };
  }, []);

  function requestClose(): void {
    // Always allow closing — including mid Google flow. Aborting unsticks
    // "Connecting to Google…" when the user dismisses Google's window/UI.
    googleAbortRef.current?.abort();
    googleAbortRef.current = null;
    setStatus("idle");
    onClose();
  }

  React.useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        requestClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // requestClose closes over latest onClose/status setters — rebind each render is fine.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  const busy = status !== "idle";
  const canSubmit = username.trim().length > 0 && password.length > 0 && !busy;

  async function handlePasswordSubmit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setStatus("submitting");
    setError(null);

    const result = await loginWithPassword({
      username: username.trim(),
      password,
      remember,
    });

    if (!result.ok) {
      setStatus("idle");
      setError(result.error);
      return;
    }

    onSuccess(result.identity);
  }

  async function handleGoogle(): Promise<void> {
    if (status !== "idle") {
      return;
    }

    googleAbortRef.current?.abort();
    const controller = new AbortController();
    googleAbortRef.current = controller;

    setStatus("google");
    setError(null);

    const result = await loginWithGoogle({ signal: controller.signal });

    if (controller.signal.aborted) {
      setStatus("idle");
      return;
    }

    if (!result.ok) {
      setStatus("idle");
      // Don't flash an error if they just closed Google — leave the form usable.
      if (!/cancelled/i.test(result.error)) {
        setError(result.error);
      }
      return;
    }

    onSuccess(result.identity);
  }

  const modal = (
    <div
      className="dg-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          requestClose();
        }
      }}
    >
      <div className="dg-modal dg-login-modal" role="dialog" aria-modal="true" aria-label="Sign in">
        <button type="button" className="dg-modal-close" onClick={requestClose} aria-label="Close">
          <CloseIcon size={14} />
        </button>

        <div className="dg-login-modal-header">
          <h3 className="dg-modal-title">Welcome back</h3>
          <p className="dg-modal-subtitle">
            Sign in with your Diesel Geeks account to save chats and pick up where you left off.
          </p>
        </div>

        <button
          type="button"
          className="dg-btn dg-btn-secondary dg-login-google-btn"
          onClick={() => void handleGoogle()}
          disabled={busy}
        >
          {status === "google" ? (
            <>
              <span className="dg-spinner" aria-hidden="true" />
              Connecting to Google…
            </>
          ) : (
            <>
              <GoogleIcon />
              Continue with Google
            </>
          )}
        </button>

        <div className="dg-login-divider" role="separator">
          <span>or</span>
        </div>

        <form className="dg-modal-form" onSubmit={(event) => void handlePasswordSubmit(event)}>
          <label className="dg-modal-field">
            <span>Username or email</span>
            <input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
              disabled={busy}
            />
          </label>

          <label className="dg-modal-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              disabled={busy}
            />
          </label>

          <label className="dg-login-remember">
            <input
              type="checkbox"
              checked={remember}
              onChange={(event) => setRemember(event.target.checked)}
              disabled={busy}
            />
            <span>Remember me</span>
          </label>

          {error ? <p className="dg-cart-shipping-error">{error}</p> : null}

          <button type="submit" className="dg-btn dg-btn-primary dg-modal-submit" disabled={!canSubmit}>
            {status === "submitting" ? (
              <>
                <span className="dg-spinner" aria-hidden="true" />
                Signing in…
              </>
            ) : (
              "Sign in"
            )}
          </button>
        </form>

        <p className="dg-login-modal-footer">
          Need an account?{" "}
          <a href="/my-account/" target="_blank" rel="noopener noreferrer">
            Register on the site
          </a>
        </p>
      </div>
    </div>
  );

  return (
    <>
      <span ref={markerRef} style={{ display: "none" }} aria-hidden="true" />
      {portalTarget ? createPortal(modal, portalTarget) : null}
    </>
  );
}

function GoogleIcon() {
  return (
    <svg className="dg-btn-icon" width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.616Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.997 8.997 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962l3.007 2.332C4.672 5.164 6.656 3.58 9 3.58Z"
      />
    </svg>
  );
}
