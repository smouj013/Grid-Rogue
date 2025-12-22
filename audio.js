optMusic?.addEventListener("change", () => {
  settings.musicOn = !!optMusic.checked;
  saveSettings();
  try {
    AudioSys?.applySettings?.(settings);
    if (settings.musicOn) AudioSys?.startMusic?.();
    else AudioSys?.stopMusic?.();
  } catch {}
});

optSfx?.addEventListener("change", () => {
  settings.sfxOn = !!optSfx.checked;
  saveSettings();
  try { AudioSys?.applySettings?.(settings); } catch {}
  try { AudioSys?.sfx?.("ui", { cooldownMs: 60 }); } catch {}
});

optMusicVol?.addEventListener("input", () => {
  settings.musicVol = clamp(parseFloat(optMusicVol.value || "0.55"), 0, 1);
  if (optMusicVolValue) optMusicVolValue.textContent = settings.musicVol.toFixed(2);
  saveSettings();
  try { AudioSys?.applySettings?.(settings); } catch {}
});

optSfxVol?.addEventListener("input", () => {
  settings.sfxVol = clamp(parseFloat(optSfxVol.value || "0.85"), 0, 1);
  if (optSfxVolValue) optSfxVolValue.textContent = settings.sfxVol.toFixed(2);
  saveSettings();
  try { AudioSys?.applySettings?.(settings); } catch {}
});
