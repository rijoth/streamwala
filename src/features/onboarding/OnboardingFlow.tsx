import React, { useState } from 'react';
import { FocusZone } from '../../shared/focus/index.ts';
import { Button, Card, TextField, LinearProgress, CircularProgress } from '../../shared/ui/index.ts';
import { Icon } from '../../shared/icons/index.ts';
import { parseAndSaveM3U, ParseProgress } from '../../services/playlist/m3uParser.ts';
import { installDemoPlaylist } from '../../services/playlist/demoPlaylist.ts';
import { importXtreamPlaylist, testXtreamLogin } from '../../services/playlist/xtreamClient.ts';
import { savePlaylist } from '../../services/storage/db.ts';
import { useSettingsStore } from '../../app/settingsStore.ts';
import { CorsDiagnosticModal } from './CorsDiagnosticModal.tsx';
import { PlaylistSourceType } from '../../domain/types.ts';

export interface OnboardingFlowProps {
  onComplete: () => void;
  onOpenSettings?: () => void;
}

type OnboardingStep = 'welcome' | 'source' | 'details' | 'importing';

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  onComplete,
  onOpenSettings,
}) => {
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [sourceType, setSourceType] = useState<PlaylistSourceType>('demo');
  const { settings } = useSettingsStore();

  // Form Fields
  const [playlistName, setPlaylistName] = useState('');
  const [m3uUrl, setM3uUrl] = useState('');
  const [epgUrl, setEpgUrl] = useState('');
  const [xtreamServer, setXtreamServer] = useState('');
  const [xtreamUser, setXtreamUser] = useState('');
  const [xtreamPass, setXtreamPass] = useState('');
  const [localFileContent, setLocalFileContent] = useState<string | null>(null);

  // Status & Progress
  const [isValidating, setIsValidating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState<ParseProgress>({
    channelsFound: 0,
    groupsFound: 0,
    percentage: 0,
    status: 'Initializing...',
  });

  // CORS Diagnostic Modal
  const [showCorsModal, setShowCorsModal] = useState(false);
  const [failedUrl, setFailedUrl] = useState('');

  // Handle source choice
  const handleSelectSource = (type: PlaylistSourceType) => {
    setSourceType(type);
    setErrorMessage(null);
    if (type === 'demo') {
      startImportDemo();
    } else {
      setStep('details');
    }
  };

  // Import Legal Public Demo
  const startImportDemo = async () => {
    setStep('importing');
    setImportProgress({
      channelsFound: 8,
      groupsFound: 3,
      percentage: 50,
      status: 'Loading verified public test streams and EPG...',
    });

    try {
      await installDemoPlaylist();
      setImportProgress({
        channelsFound: 8,
        groupsFound: 3,
        percentage: 100,
        status: 'Demo streams loaded successfully!',
      });
      setTimeout(() => {
        onComplete();
      }, 700);
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to install demo playlist');
      setStep('source');
    }
  };

  // Handle local file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPlaylistName(file.name.replace(/\.[^/.]+$/, ''));
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setLocalFileContent(text);
    };
    reader.readAsText(file);
  };

  // Validate and start import
  const handleStartImport = async () => {
    setErrorMessage(null);
    setIsValidating(true);

    try {
      if (sourceType === 'm3u') {
        if (!m3uUrl.trim()) {
          setErrorMessage('Please enter an M3U or M3U8 URL.');
          setIsValidating(false);
          return;
        }

        let fetchUrl = m3uUrl.trim();
        if (settings.proxyUrlTemplate) {
          fetchUrl = settings.proxyUrlTemplate.replace('{url}', encodeURIComponent(fetchUrl));
        }

        setStep('importing');
        setImportProgress({
          channelsFound: 0,
          groupsFound: 0,
          percentage: 10,
          status: 'Connecting to playlist source...',
        });

        const res = await fetch(fetchUrl, { signal: AbortSignal.timeout(12000) });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        const content = await res.text();
        if (!content.includes('#EXTM3U') && !content.includes('#EXTINF')) {
          throw new Error('Provided URL does not return a valid #EXTM3U playlist format.');
        }

        const playlistId = `m3u_${Date.now()}`;
        const result = await parseAndSaveM3U(content, {
          playlistId,
          onProgress: (p) => setImportProgress(p),
        });

        await savePlaylist({
          id: playlistId,
          name: playlistName.trim() || 'My M3U Playlist',
          type: 'm3u',
          url: m3uUrl.trim(),
          epgUrl: epgUrl.trim() || undefined,
          createdAt: Date.now(),
          lastSyncedAt: Date.now(),
          channelCount: result.channelCount,
          isActive: true,
        });

        setTimeout(onComplete, 800);
      } else if (sourceType === 'xtream') {
        if (!xtreamServer.trim() || !xtreamUser.trim() || !xtreamPass.trim()) {
          setErrorMessage('Server URL, Username, and Password are all required.');
          setIsValidating(false);
          return;
        }

        // Test login first
        const testRes = await testXtreamLogin(
          { serverUrl: xtreamServer, username: xtreamUser, password: xtreamPass },
          settings.proxyUrlTemplate
        );

        if (!testRes.success) {
          setFailedUrl(xtreamServer);
          if (testRes.message.includes('CORS') || testRes.message.includes('Network error')) {
            setShowCorsModal(true);
          }
          throw new Error(testRes.message);
        }

        setStep('importing');
        await importXtreamPlaylist(
          { serverUrl: xtreamServer, username: xtreamUser, password: xtreamPass },
          playlistName.trim() || 'My Xtream IPTV',
          settings.proxyUrlTemplate,
          (status) => setImportProgress(prev => ({ ...prev, status }))
        );

        setTimeout(onComplete, 800);
      } else if (sourceType === 'file') {
        if (!localFileContent) {
          setErrorMessage('Please select a local .m3u or .m3u8 file.');
          setIsValidating(false);
          return;
        }

        setStep('importing');
        const playlistId = `file_${Date.now()}`;
        const result = await parseAndSaveM3U(localFileContent, {
          playlistId,
          onProgress: (p) => setImportProgress(p),
        });

        await savePlaylist({
          id: playlistId,
          name: playlistName.trim() || 'Local M3U File',
          type: 'file',
          createdAt: Date.now(),
          lastSyncedAt: Date.now(),
          channelCount: result.channelCount,
          isActive: true,
        });

        setTimeout(onComplete, 800);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setStep('details');
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('CORS')) {
        setFailedUrl(m3uUrl || xtreamServer);
        setShowCorsModal(true);
      }
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="relative w-screen h-screen bg-[var(--md-sys-color-surface-dim)] text-[var(--md-sys-color-on-surface)] flex flex-col justify-center items-center p-8 tv-safe-container overflow-y-auto">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-[var(--md-sys-color-primary)] opacity-10 rounded-full blur-[140px] pointer-events-none" />

      {/* STEP 1: WELCOME SCREEN */}
      {step === 'welcome' && (
        <FocusZone className="flex flex-col items-center text-center max-w-2xl gap-6 z-10 animate-fade-in">
          <div className="w-24 h-24 rounded-3xl bg-[var(--md-sys-color-primary)] text-[var(--md-sys-color-on-primary)] flex items-center justify-center shadow-2xl mb-2">
            <Icon name="live_tv" size={56} />
          </div>

          <div>
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-3">
              Aether IPTV
            </h1>
            <p className="text-lg md:text-xl text-[var(--md-sys-color-on-surface-variant)] leading-relaxed">
              The premier 100% client-side leanback IPTV player designed for your Android TV remote and high-resolution screens.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 mt-4">
            <Button
              variant="filled"
              icon="arrow_forward"
              autoFocus
              onClick={() => setStep('source')}
              className="text-lg !px-10 !py-4 shadow-xl"
            >
              Get Started
            </Button>
            {onOpenSettings && (
              <Button
                variant="tonal"
                icon="settings"
                onClick={onOpenSettings}
                className="text-base !px-6 !py-4"
              >
                Settings
              </Button>
            )}
          </div>
        </FocusZone>
      )}

      {/* STEP 2: CHOOSE SOURCE TYPE */}
      {step === 'source' && (
        <div className="flex flex-col items-center max-w-4xl w-full gap-8 z-10 animate-fade-in">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight mb-2">Choose an IPTV Source</h2>
            <p className="text-[var(--md-sys-color-on-surface-variant)] text-base">
              Select how you would like to import your live channels and guide data.
            </p>
          </div>

          <FocusZone className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
            <SourceCard
              title="M3U / M3U8 URL"
              description="Import online playlist via direct HTTPS link with auto EPG mapping."
              icon="link"
              onClick={() => handleSelectSource('m3u')}
              autoFocus
            />

            <SourceCard
              title="Xtream Codes API"
              description="Connect with your IPTV server URL, username, and password."
              icon="dns"
              onClick={() => handleSelectSource('xtream')}
            />

            <SourceCard
              title="Local M3U File"
              description="Upload an existing .m3u or .m3u8 file from your storage."
              icon="upload_file"
              onClick={() => handleSelectSource('file')}
            />

            <SourceCard
              title="Legal Public Test Streams"
              description="Instant setup with high-definition NASA, Blender, and public live channels."
              icon="verified"
              badge="Recommended"
              onClick={() => handleSelectSource('demo')}
            />
          </FocusZone>

          <Button
            variant="text"
            icon="arrow_back"
            onClick={() => setStep('welcome')}
            className="mt-2"
          >
            Back to Welcome
          </Button>
        </div>
      )}

      {/* STEP 3: ENTER DETAILS */}
      {step === 'details' && (
        <div className="flex flex-col items-center max-w-2xl w-full gap-6 z-10 animate-fade-in">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight mb-1">
              {sourceType === 'm3u' && 'Enter M3U Playlist URL'}
              {sourceType === 'xtream' && 'Xtream Codes Credentials'}
              {sourceType === 'file' && 'Select Local M3U File'}
            </h2>
            <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">
              All credentials and stream data remain 100% private in your device's local IndexedDB.
            </p>
          </div>

          <FocusZone className="w-full flex flex-col gap-4 bg-[var(--md-sys-color-surface-container)] p-6 rounded-3xl border border-[var(--md-sys-color-outline-variant)]">
            <TextField
              label="Playlist Name (Optional)"
              value={playlistName}
              onChange={setPlaylistName}
              placeholder="e.g. My Home IPTV"
              icon="badge"
              autoFocus={sourceType !== 'file'}
            />

            {sourceType === 'm3u' && (
              <>
                <TextField
                  label="M3U / M3U8 Playlist URL *"
                  value={m3uUrl}
                  onChange={setM3uUrl}
                  placeholder="https://example.com/playlist.m3u8"
                  type="url"
                  icon="link"
                  error={errorMessage || undefined}
                  onSubmit={handleStartImport}
                  hint="Must start with http:// or https://"
                />
                <TextField
                  label="XMLTV EPG URL (Optional)"
                  value={epgUrl}
                  onChange={setEpgUrl}
                  placeholder="https://example.com/epg.xml"
                  type="url"
                  icon="schedule"
                />
              </>
            )}

            {sourceType === 'xtream' && (
              <>
                <TextField
                  label="Server URL *"
                  value={xtreamServer}
                  onChange={setXtreamServer}
                  placeholder="http://server.iptv.com:8080"
                  type="url"
                  icon="dns"
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <TextField
                    label="Username *"
                    value={xtreamUser}
                    onChange={setXtreamUser}
                    placeholder="Username"
                    icon="person"
                  />
                  <TextField
                    label="Password *"
                    value={xtreamPass}
                    onChange={setXtreamPass}
                    placeholder="Password"
                    type="password"
                    icon="key"
                    onSubmit={handleStartImport}
                  />
                </div>
              </>
            )}

            {sourceType === 'file' && (
              <div className="flex flex-col gap-2 p-4 rounded-2xl bg-[var(--md-sys-color-surface-container-high)] border border-dashed border-[var(--md-sys-color-outline)] text-center">
                <input
                  type="file"
                  accept=".m3u,.m3u8,text/plain"
                  onChange={handleFileChange}
                  className="hidden"
                  id="m3u-file-input"
                />
                <label
                  htmlFor="m3u-file-input"
                  className="cursor-pointer py-4 flex flex-col items-center gap-2 text-sm text-[var(--md-sys-color-primary)] font-semibold"
                >
                  <Icon name="folder_open" size={36} />
                  <span>{localFileContent ? 'File loaded! Click to replace' : 'Click to choose M3U / M3U8 file'}</span>
                </label>
                {localFileContent && (
                  <p className="text-xs text-emerald-400">
                    File ready ({Math.round(localFileContent.length / 1024)} KB)
                  </p>
                )}
              </div>
            )}

            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-950/60 border border-red-800 text-red-200 text-xs flex items-center gap-2">
                <Icon name="error" size={18} className="shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-4 mt-2 border-t border-[var(--md-sys-color-outline-variant)]">
              <Button
                variant="text"
                icon="arrow_back"
                onClick={() => setStep('source')}
              >
                Back
              </Button>

              <Button
                variant="filled"
                icon={isValidating ? undefined : 'download'}
                disabled={isValidating}
                onClick={handleStartImport}
                className="!px-8"
              >
                {isValidating ? (
                  <div className="flex items-center gap-2">
                    <CircularProgress size={18} />
                    <span>Verifying...</span>
                  </div>
                ) : (
                  'Start Import'
                )}
              </Button>
            </div>
          </FocusZone>
        </div>
      )}

      {/* STEP 4: IMPORTING PROGRESS */}
      {step === 'importing' && (
        <div className="flex flex-col items-center max-w-lg w-full gap-6 text-center z-10 animate-fade-in">
          <div className="w-20 h-20 rounded-3xl bg-[var(--md-sys-color-surface-container-high)] flex items-center justify-center text-[var(--md-sys-color-primary)] shadow-2xl">
            <CircularProgress size={44} />
          </div>

          <div>
            <h2 className="text-2xl font-bold tracking-tight mb-2">Importing Channels</h2>
            <p className="text-sm text-[var(--md-sys-color-on-surface-variant)]">{importProgress.status}</p>
          </div>

          <div className="w-full space-y-2">
            <LinearProgress value={importProgress.percentage} />
            <div className="flex justify-between text-xs font-mono text-[var(--md-sys-color-outline)]">
              <span>{importProgress.channelsFound} channels</span>
              <span>{importProgress.groupsFound} categories</span>
            </div>
          </div>
        </div>
      )}

      {/* CORS Diagnostic Modal */}
      <CorsDiagnosticModal
        isOpen={showCorsModal}
        onClose={() => setShowCorsModal(false)}
        failedUrl={failedUrl}
        errorDetails={errorMessage || undefined}
        onTryDemo={() => {
          setShowCorsModal(false);
          startImportDemo();
        }}
        onOpenSettings={() => {
          setShowCorsModal(false);
          onOpenSettings?.();
        }}
      />
    </div>
  );
};

interface SourceCardProps {
  title: string;
  description: string;
  icon: string;
  badge?: string;
  autoFocus?: boolean;
  onClick: () => void;
}

const SourceCard: React.FC<SourceCardProps> = ({
  title,
  description,
  icon,
  badge,
  autoFocus,
  onClick,
}) => {
  return (
    <Card
      variant="filled"
      autoFocus={autoFocus}
      onClick={onClick}
      className="p-6 text-left flex items-start gap-4 border border-[var(--md-sys-color-outline-variant)] hover:border-[var(--md-sys-color-primary)] group"
    >
      <div className="w-14 h-14 rounded-2xl bg-[var(--md-sys-color-primary-container)] text-[var(--md-sys-color-on-primary-container)] flex items-center justify-center shrink-0 shadow-md">
        <Icon name={icon} size={28} />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-bold text-lg text-[var(--md-sys-color-on-surface)] group-hover:text-[var(--md-sys-color-primary)]">
            {title}
          </h3>
          {badge && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-semibold">
              {badge}
            </span>
          )}
        </div>
        <p className="text-sm text-[var(--md-sys-color-on-surface-variant)] leading-normal">
          {description}
        </p>
      </div>
    </Card>
  );
};
