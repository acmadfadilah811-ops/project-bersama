import { useState, useEffect } from 'react';
import { RefreshCw, Check, MoreVertical, Printer } from 'lucide-react';

const defaultSettings = {
  marginTop: 10,
  marginBottom: 10,
  marginLeft: 10,
  marginRight: 10,
  paperWidth: 210,
  labelsPerLine: 2,
  padding: 8,
  labelWidth: 90,
  labelHeight: 45,
  useAltName: true,
  showBarcode: true,
  showWeight: true,
  showPromo: true,
  storeName: 'Bintang Advertising'
};

// Inline SVGs matching Olsera layout icons exactly
const IconMarginTop = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="#94a3b8" strokeWidth="1.5" />
    <path d="M2 5H14" stroke="#0ea5e9" strokeWidth="2" />
    <path d="M8 5V2" stroke="#0ea5e9" strokeWidth="1.5" strokeDasharray="1.5 1.5" />
  </svg>
);

const IconMarginBottom = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="#94a3b8" strokeWidth="1.5" />
    <path d="M2 11H14" stroke="#0ea5e9" strokeWidth="2" />
    <path d="M8 11V14" stroke="#0ea5e9" strokeWidth="1.5" strokeDasharray="1.5 1.5" />
  </svg>
);

const IconMarginLeft = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="#94a3b8" strokeWidth="1.5" />
    <path d="M5 2V14" stroke="#0ea5e9" strokeWidth="2" />
    <path d="M5 8H2" stroke="#0ea5e9" strokeWidth="1.5" strokeDasharray="1.5 1.5" />
  </svg>
);

const IconMarginRight = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="12" height="12" rx="1.5" stroke="#94a3b8" strokeWidth="1.5" />
    <path d="M11 2V14" stroke="#0ea5e9" strokeWidth="2" />
    <path d="M11 8H14" stroke="#0ea5e9" strokeWidth="1.5" strokeDasharray="1.5 1.5" />
  </svg>
);

const IconWidth = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 3V13" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M14 3V13" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M2 8H14" stroke="#0ea5e9" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M5 5L2 8L5 11" stroke="#0ea5e9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M11 5L14 8L11 11" stroke="#0ea5e9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconHeight = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M3 2H13" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M3 14H13" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M8 2V14" stroke="#0ea5e9" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M5 5L8 2L11 5" stroke="#0ea5e9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5 11L8 14L11 11" stroke="#0ea5e9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const IconLabelsPerLine = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="12" height="12" rx="1" stroke="#94a3b8" strokeWidth="1.5" />
    <line x1="8" y1="2" x2="8" y2="14" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="2 2" />
    <rect x="3.5" y="4" width="3" height="8" rx="0.5" fill="#0ea5e9" />
    <rect x="9.5" y="4" width="3" height="8" rx="0.5" fill="#0ea5e9" />
  </svg>
);

const IconPadding = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="2" y="2" width="12" height="12" rx="1" stroke="#94a3b8" strokeWidth="1.5" strokeDasharray="2 2" />
    <rect x="4.5" y="4.5" width="7" height="7" rx="0.5" stroke="#0ea5e9" strokeWidth="1.5" />
  </svg>
);

const SwitchToggle = ({ checked, onChange }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
    <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'bold' }}>Tidak</span>
    <div 
      onClick={() => onChange(!checked)}
      style={{
        width: '36px',
        height: '20px',
        borderRadius: '10px',
        background: checked ? '#0ea5e9' : '#cbd5e1',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background 0.2s'
      }}
    >
      <div style={{
        width: '16px',
        height: '16px',
        borderRadius: '50%',
        background: '#ffffff',
        position: 'absolute',
        top: '2px',
        left: checked ? '18px' : '2px',
        transition: 'left 0.2s',
        boxShadow: '0 1px 3px rgba(0,0,0,0.15)'
      }} />
    </div>
    <span style={{ fontSize: '11px', color: checked ? '#0ea5e9' : '#94a3b8', fontWeight: 'bold' }}>Ya</span>
  </div>
);

const IconInput = ({ label, value, onChange, type = "number", icon: Icon }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
    <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>{label}</span>
    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden', height: '38px', background: '#ffffff' }}>
      <div style={{ width: '38px', height: '100%', background: '#f8fafc', borderRight: '1px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Icon />
      </div>
      <input 
        type={type}
        value={value}
        onChange={(e) => onChange(type === 'number' ? parseInt(e.target.value) || 0 : e.target.value)}
        style={{ border: 0, outline: 'none', padding: '0 12px', fontSize: '13px', color: '#334155', width: '100%', height: '100%' }}
      />
    </div>
  </div>
);

export function PriceLabelSettingsPage() {
  const [settings, setSettings] = useState(() => {
    const saved = localStorage.getItem('price_label_settings');
    if (saved) {
      try {
        return { ...defaultSettings, ...JSON.parse(saved) };
      } catch (e) {
        console.error('Failed to parse price_label_settings', e);
      }
    }
    return defaultSettings;
  });

  const [saveSuccess, setSaveSuccess] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    localStorage.setItem('price_label_settings', JSON.stringify(settings));
  }, [settings]);

  // Close options menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.settings-menu-container')) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleChange = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleReset = () => {
    setSettings(defaultSettings);
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  const handleSave = () => {
    localStorage.setItem('price_label_settings', JSON.stringify(settings));
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  };

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '16px', marginBottom: '16px' }}>
        {/* Left Column: Form Settings card */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', height: 'fit-content' }}>
          {/* Header of settings card */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '12px', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#1e293b', margin: 0 }}>Pengaturan</h3>
            <div className="settings-menu-container" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <button 
                type="button"
                onClick={() => setShowMenu(!showMenu)}
                style={{ background: 'transparent', border: 0, padding: '4px', cursor: 'pointer', color: '#94a3b8', display: 'flex', alignItems: 'center' }}
              >
                <MoreVertical size={18} />
              </button>

              {showMenu && (
                <div style={{
                  position: 'absolute',
                  top: '28px',
                  right: 0,
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  zIndex: 100,
                  width: '160px',
                  padding: '4px 0',
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <button
                    type="button"
                    onClick={() => {
                      handleSave();
                      setShowMenu(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '13px',
                      color: '#334155',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 0,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#f1f5f9'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <Check size={14} style={{ color: '#16a34a' }} />
                    <span>{saveSuccess ? 'Disimpan' : 'Simpan'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      handleReset();
                      setShowMenu(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '13px',
                      color: '#dc2626',
                      textAlign: 'left',
                      background: 'transparent',
                      border: 0,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = '#fee2e2'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <RefreshCw size={14} />
                    <span>Reset ke Default</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div style={{ maxHeight: '420px', overflowY: 'auto', paddingRight: '8px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Group 1: Kertas */}
            <div style={{ display: 'flex', gap: '24px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ width: '80px', fontSize: '13px', fontWeight: 'bold', color: '#475569', paddingTop: '18px' }}>
                Kertas
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <IconInput label="Atas" value={settings.marginTop} onChange={(val) => handleChange('marginTop', val)} icon={IconMarginTop} />
                  <IconInput label="Bawah" value={settings.marginBottom} onChange={(val) => handleChange('marginBottom', val)} icon={IconMarginBottom} />
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <IconInput label="Kiri" value={settings.marginLeft} onChange={(val) => handleChange('marginLeft', val)} icon={IconMarginLeft} />
                  <IconInput label="Kanan" value={settings.marginRight} onChange={(val) => handleChange('marginRight', val)} icon={IconMarginRight} />
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div style={{ flex: 0.5 }}>
                    <IconInput label="Lebar" value={settings.paperWidth} onChange={(val) => handleChange('paperWidth', val)} icon={IconWidth} />
                  </div>
                </div>
              </div>
            </div>

            {/* Group 2: Label */}
            <div style={{ display: 'flex', gap: '24px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
              <div style={{ width: '80px', fontSize: '13px', fontWeight: 'bold', color: '#475569', paddingTop: '18px' }}>
                Label
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <IconInput label="Jumlah label per baris" value={settings.labelsPerLine} onChange={(val) => handleChange('labelsPerLine', val)} icon={IconLabelsPerLine} />
                  <IconInput label="Padding" value={settings.padding} onChange={(val) => handleChange('padding', val)} icon={IconPadding} />
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <IconInput label="Lebar" value={settings.labelWidth} onChange={(val) => handleChange('labelWidth', val)} icon={IconWidth} />
                  <IconInput label="Tinggi" value={settings.labelHeight} onChange={(val) => handleChange('labelHeight', val)} icon={IconHeight} />
                </div>
              </div>
            </div>

            {/* Group 3: Switch Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>Gunakan nama alternatif</span>
                <SwitchToggle checked={settings.useAltName} onChange={(val) => handleChange('useAltName', val)} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>Tampilkan nomor barcode</span>
                <SwitchToggle checked={settings.showBarcode} onChange={(val) => handleChange('showBarcode', val)} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>Tampilkan berat produk</span>
                <SwitchToggle checked={settings.showWeight} onChange={(val) => handleChange('showWeight', val)} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>Desain promo untuk harga diskon</span>
                <SwitchToggle checked={settings.showPromo} onChange={(val) => handleChange('showPromo', val)} />
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Preview block matching screenshot */}
        <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', height: 'fit-content' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', color: '#334155', margin: 0 }}>Preview</h3>
            <button 
              type="button"
              disabled={true}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                background: '#cbd5e1',
                color: '#94a3b8',
                border: 0,
                borderRadius: '6px',
                padding: '0 16px',
                height: '32px',
                fontSize: '12px',
                fontWeight: 'bold',
                cursor: 'not-allowed'
              }}
            >
              <Printer size={14} />
              <span>Cetak</span>
            </button>
          </div>

          <div style={{ display: 'grid', placeItems: 'center', minHeight: '120px', background: '#f8fafc', color: '#64748b', border: '1px dashed #cbd5e1', borderRadius: '10px', fontSize: '13px', padding: '20px', textAlign: 'center' }}>
            Label harga produk akan muncul di sini
          </div>
        </div>
      </div>
    </>
  );
}
