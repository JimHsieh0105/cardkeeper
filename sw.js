:root {
  --ink: #1B2A4A;
  --ink-soft: #2E3F63;
  --parchment: #F7F3EC;
  --parchment-dim: #EFE9DD;
  --gold: #B08D57;
  --gold-light: #D9C7A8;
  --slate: #8B93A3;
  --rust: #A6493A;
  --white: #FFFFFF;
  --shadow: 0 8px 24px rgba(27, 42, 74, 0.10);
  --shadow-lg: 0 16px 40px rgba(27, 42, 74, 0.18);
  --radius: 16px;
  --serif: Georgia, "Noto Serif TC", "PingFang TC", serif;
  --sans: -apple-system, BlinkMacSystemFont, "PingFang TC", "Helvetica Neue", sans-serif;
}

* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }

html, body {
  margin: 0;
  height: 100%;
  background: var(--parchment);
  color: var(--ink);
  font-family: var(--sans);
  overscroll-behavior-y: none;
}

#app {
  max-width: 560px;
  margin: 0 auto;
  min-height: 100vh;
  position: relative;
}

.hidden { display: none !important; }

/* ---------- Views ---------- */
.view {
  display: none;
  min-height: 100vh;
  padding-bottom: 40px;
  animation: fadeIn .22s ease;
}
.view.active { display: block; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(6px);} to { opacity: 1; transform: translateY(0);} }

/* ---------- Topbar ---------- */
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(env(safe-area-inset-top) + 14px) 18px 14px;
  position: sticky;
  top: 0;
  background: var(--parchment);
  z-index: 5;
  border-bottom: 1px solid var(--parchment-dim);
}
.brand { display: flex; flex-direction: column; line-height: 1.1; }
.brand-mark { font-family: var(--serif); font-size: 22px; letter-spacing: .3px; color: var(--ink); }
.brand-sub { font-size: 10px; letter-spacing: 2.5px; color: var(--gold); text-transform: uppercase; margin-top: 2px; }
.brand-center { font-family: var(--serif); font-size: 17px; color: var(--ink); }

.icon-btn {
  width: 40px; height: 40px;
  border-radius: 50%;
  border: 1px solid var(--gold-light);
  background: var(--white);
  color: var(--ink);
  display: flex; align-items: center; justify-content: center;
  box-shadow: var(--shadow);
}
.icon-btn svg { width: 20px; height: 20px; }

.link-btn {
  background: none; border: none;
  font-size: 15px; color: var(--ink-soft);
  padding: 6px 2px;
}
.link-btn-strong { color: var(--gold); font-weight: 600; }
.topbar-spacer { flex: 1; }

/* ---------- Search + tags ---------- */
.search-row { padding: 14px 18px 0; }
#search {
  width: 100%;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--parchment-dim);
  background: var(--white);
  font-size: 15px;
  color: var(--ink);
}
#search:focus { outline: 2px solid var(--gold-light); }

.tag-chips {
  display: flex; gap: 8px; overflow-x: auto;
  padding: 12px 18px 4px;
  scrollbar-width: none;
}
.tag-chips::-webkit-scrollbar { display: none; }
.chip {
  flex: 0 0 auto;
  padding: 6px 13px;
  border-radius: 999px;
  border: 1px solid var(--gold-light);
  background: var(--white);
  font-size: 12.5px;
  color: var(--ink-soft);
  white-space: nowrap;
}
.chip.active { background: var(--ink); color: var(--parchment); border-color: var(--ink); }

/* ---------- Card list ---------- */
.card-list { padding: 10px 18px 90px; padding-right: 44px; }
.card-item {
  display: flex; align-items: center; gap: 12px;
  background: var(--white);
  border-radius: var(--radius);
  padding: 12px 14px;
  margin-bottom: 10px;
  box-shadow: var(--shadow);
  border-left: 3px solid var(--gold);
}
.card-item:active { transform: scale(.985); }
.card-thumb {
  width: 46px; height: 46px; border-radius: 50%;
  background: var(--ink);
  color: var(--parchment);
  display: flex; align-items: center; justify-content: center;
  font-family: var(--serif); font-size: 17px;
  flex: 0 0 auto;
  overflow: hidden;
}
.card-thumb img { width: 100%; height: 100%; object-fit: cover; }
.card-info { min-width: 0; flex: 1; }
.card-name { font-weight: 600; font-size: 15.5px; color: var(--ink); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-meta { font-size: 12.5px; color: var(--slate); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
.card-chevron { color: var(--gold-light); font-size: 18px; }

.section-label {
  font-family: var(--serif);
  font-size: 12px;
  letter-spacing: 2px;
  color: var(--gold);
  padding: 14px 4px 6px;
  text-transform: uppercase;
}

/* ---------- A-Z rail (signature element) ---------- */
.az-rail {
  position: fixed;
  right: max(6px, calc((100vw - 560px) / 2 + 6px));
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1px;
  z-index: 6;
}
.az-rail span {
  font-size: 9.5px;
  color: var(--gold);
  padding: 1.5px 3px;
  font-weight: 600;
}
.az-rail span.dim { color: var(--gold-light); }

/* ---------- Empty state ---------- */
.empty-state { text-align: center; padding: 70px 30px 0; color: var(--slate); }
.empty-card {
  width: 92px; height: 60px; margin: 0 auto 20px;
  border-radius: 10px;
  border: 2px dashed var(--gold-light);
  position: relative;
}
.empty-card::after {
  content: "";
  position: absolute; left: 12px; top: 16px;
  width: 50px; height: 3px; background: var(--gold-light); border-radius: 2px;
  box-shadow: 0 10px 0 var(--gold-light);
}
.empty-state p { margin: 4px 0; font-family: var(--serif); font-size: 17px; color: var(--ink); }
.empty-sub { font-family: var(--sans) !important; font-size: 13px !important; color: var(--slate) !important; line-height: 1.6; }

/* ---------- Buttons ---------- */
.btn-primary, .btn-secondary, .btn-danger {
  width: 100%;
  padding: 14px;
  border-radius: 12px;
  font-size: 15.5px;
  font-weight: 600;
  border: none;
}
.btn-primary { background: var(--ink); color: var(--parchment); box-shadow: var(--shadow); }
.btn-secondary { background: var(--white); color: var(--ink); border: 1px solid var(--gold-light); margin-top: 20px; }
.btn-danger { background: var(--white); color: var(--rust); border: 1px solid var(--rust); margin-top: 26px; }

/* ---------- Scan view ---------- */
.scan-stage { padding: 24px 18px; }
.scan-drop {
  aspect-ratio: 1.58 / 1;
  border-radius: 18px;
  background: var(--white);
  border: 1.5px dashed var(--gold-light);
  display: flex; align-items: center; justify-content: center;
  overflow: hidden;
  box-shadow: var(--shadow);
}
.scan-preview { width: 100%; height: 100%; object-fit: cover; }
.scan-placeholder { text-align: center; color: var(--slate); padding: 20px; }
.scan-card-icon {
  width: 56px; height: 38px; margin: 0 auto 12px;
  border-radius: 6px; background: var(--parchment-dim);
  border: 1px solid var(--gold-light);
}
.scan-placeholder p { font-size: 13.5px; }
.scan-actions { display: flex; flex-direction: column; gap: 10px; margin-top: 18px; }
.hidden-input { display: none; }

.ocr-status {
  display: flex; align-items: center; justify-content: center; gap: 10px;
  margin-top: 18px; color: var(--ink-soft); font-size: 13.5px;
}
.spinner {
  width: 16px; height: 16px; border-radius: 50%;
  border: 2px solid var(--gold-light); border-top-color: var(--gold);
  animation: spin .8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ---------- Edit form ---------- */
.edit-form { padding: 18px 18px 60px; }
.photo-row { display: flex; justify-content: center; margin-bottom: 20px; }
.edit-photo-wrap {
  width: 100%; aspect-ratio: 1.58/1; max-width: 320px;
  border-radius: 14px; background: var(--white);
  border: 1px solid var(--parchment-dim);
  display: flex; align-items: center; justify-content: center;
  color: var(--slate); font-size: 13px;
  overflow: hidden;
}
.edit-photo { width: 100%; height: 100%; object-fit: cover; }

.field { display: block; margin-bottom: 14px; }
.field span { display: block; font-size: 12.5px; color: var(--slate); margin-bottom: 5px; }
.field small { color: var(--gold-light); font-weight: 400; }
.field input, .field textarea {
  width: 100%; padding: 11px 12px;
  border-radius: 10px; border: 1px solid var(--parchment-dim);
  background: var(--white); font-size: 15px; color: var(--ink);
  font-family: var(--sans);
  resize: none;
}
.field input:focus, .field textarea:focus { outline: 2px solid var(--gold-light); }
.field-row { display: flex; gap: 10px; }
.field-row .field { flex: 1; }

/* ---------- Detail view ---------- */
.detail-card-wrap { padding: 30px 22px 20px; text-align: center; }
.detail-photo {
  width: 96px; height: 96px; border-radius: 50%;
  margin: 0 auto 14px;
  background: var(--ink);
  color: var(--parchment);
  display: flex; align-items: center; justify-content: center;
  font-family: var(--serif); font-size: 34px;
  overflow: hidden;
  box-shadow: var(--shadow-lg);
}
.detail-photo img { width: 100%; height: 100%; object-fit: cover; }
.detail-name { font-family: var(--serif); font-size: 25px; margin: 0; color: var(--ink); }
.detail-sub { color: var(--slate); font-size: 14px; margin: 6px 0 0; }

.detail-actions { display: flex; justify-content: center; gap: 14px; margin: 22px 0 6px; }
.detail-action {
  display: flex; flex-direction: column; align-items: center; gap: 6px;
  width: 84px; padding: 12px 4px;
  background: var(--white); border-radius: 14px;
  box-shadow: var(--shadow);
  text-decoration: none; color: var(--ink);
  font-size: 11.5px;
  border: none;
}
.detail-action-icon { font-size: 18px; }

.detail-fields { text-align: left; margin-top: 16px; }
.detail-field {
  padding: 13px 4px; border-bottom: 1px solid var(--parchment-dim);
  display: flex; gap: 16px;
}
.detail-field .k { flex: 0 0 64px; font-size: 12.5px; color: var(--gold); padding-top: 1px; }
.detail-field .v { flex: 1; font-size: 14.5px; color: var(--ink); white-space: pre-line; }

@media (min-width: 561px) {
  .az-rail { right: calc((100vw - 560px) / 2 + 6px); }
}
