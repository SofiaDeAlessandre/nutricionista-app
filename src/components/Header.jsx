import { useState } from 'react';
import { supabase } from '../lib/supabaseClient.js';

export default function Header({ subtitle, onLogout, onBack }) {
  const [cambiando, setCambiando] = useState(false);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [ok, setOk] = useState(false);

  function abrirCambioPassword() {
    setPassword('');
    setPassword2('');
    setError('');
    setOk(false);
    setCambiando(true);
  }

  async function guardarPassword(e) {
    e.preventDefault();
    if (password.length < 6) {
      setError('La contraseña tiene que tener al menos 6 caracteres.');
      return;
    }
    if (password !== password2) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    setGuardando(true);
    setError('');
    const { error: updErr } = await supabase.auth.updateUser({ password });
    setGuardando(false);
    if (updErr) {
      setError('No se pudo cambiar la contraseña. Probá de nuevo.');
      return;
    }
    setOk(true);
  }

  return (
    <header className="app-header">
      <div className="brand">
        <img src="/florencia-logo.png" alt="" />
        <div>
          <b>Florencia Meccico</b>
          <span>{subtitle}</span>
        </div>
      </div>
      <div className="header-actions">
        {onBack && (
          <button className="pill-btn" onClick={onBack}>
            <span className="ic">🏠</span> Inicio
          </button>
        )}
        <button className="btn-ghost" onClick={abrirCambioPassword} title="Cambiar contraseña" aria-label="Cambiar contraseña">
          🔒<span className="hide-sm"> Cambiar contraseña</span>
        </button>
        {onLogout && (
          <button className="btn-ghost" onClick={onLogout}>Cerrar sesión</button>
        )}
      </div>

      {cambiando && (
        <div className="modal-overlay" onClick={() => setCambiando(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            {ok ? (
              <>
                <h3>Listo ✓</h3>
                <p>Tu contraseña se actualizó correctamente.</p>
                <div className="modal-actions">
                  <button
                    className="btn-primary"
                    style={{ width: 'auto', padding: '11px 20px' }}
                    onClick={() => setCambiando(false)}
                  >
                    Cerrar
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={guardarPassword}>
                <h3>Cambiar contraseña</h3>
                <div className="field">
                  <label>Nueva contraseña</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
                <div className="field">
                  <label>Repetir contraseña</label>
                  <input
                    type="password"
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                    autoComplete="new-password"
                    required
                  />
                </div>
                {error && <p className="login-error">{error}</p>}
                <div className="modal-actions">
                  <button type="button" className="btn-sm" onClick={() => setCambiando(false)}>
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="btn-primary"
                    style={{ width: 'auto', padding: '11px 20px' }}
                    disabled={guardando}
                  >
                    {guardando ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
