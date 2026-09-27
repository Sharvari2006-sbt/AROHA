import React, { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { WebView } from 'react-native-webview';

import BackButton from '@/src/components/BackButton';
import PressableCard from '@/src/components/PressableCard';
import PrimaryButton from '@/src/components/PrimaryButton';
import ScreenShell from '@/src/components/ScreenShell';
import { backendBase, getAccessToken } from '@/src/api/auth';
import { getAssignment, listAssignmentHighlights, MaterialHighlight, saveAssignmentHighlightsPdf, SupervisedAssignment } from '@/src/api/supervised';
import { colors, radius, spacing } from '@/src/theme';

export default function RevisionNoteDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [assignment, setAssignment] = useState<SupervisedAssignment | null>(null);
  const [highlights, setHighlights] = useState<MaterialHighlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [viewerToken, setViewerToken] = useState('');
  const [viewerError, setViewerError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        if (!id || id === '[id]') throw new Error('Open revision notes from your library.');
        const [found, saved, token] = await Promise.all([getAssignment(id), listAssignmentHighlights(id), getAccessToken()]);
        setAssignment(found); setHighlights(saved); setViewerToken(token);
      } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not open these revision notes.'); }
      finally { setLoading(false); }
    })();
  }, [id]);

  const viewerHtml = useMemo(() => {
    if (!assignment || !viewerToken) return '';
    const base = backendBase();
    const pdfUrl = `${base}/api/supervised/assignments/${assignment.id}/highlights/pdf`;
    const moduleUrl = `${base}/api/assets/pdfjs/pdf.min.mjs`;
    const workerUrl = `${base}/api/assets/pdfjs/pdf.worker.min.mjs`;
    return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"><style>html,body{margin:0;background:#eeeae4;font-family:system-ui,sans-serif}#status{padding:24px;text-align:center;color:#6e675f;font-size:14px}.page{display:block;margin:12px auto;background:#fff;box-shadow:0 3px 14px rgba(41,37,31,.16);border-radius:4px}</style></head><body><div id="status">Opening your revision PDF…</div><div id="pages"></div><script type="module">import * as pdfjsLib from ${JSON.stringify(moduleUrl)};pdfjsLib.GlobalWorkerOptions.workerSrc=${JSON.stringify(workerUrl)};const send=(value)=>window.ReactNativeWebView?.postMessage(JSON.stringify(value));try{const response=await fetch(${JSON.stringify(pdfUrl)},{headers:{Authorization:${JSON.stringify(`Bearer ${viewerToken}`)}}});if(!response.ok)throw new Error('PDF could not be loaded ('+response.status+').');const bytes=await response.arrayBuffer();const pdf=await pdfjsLib.getDocument({data:bytes}).promise;document.getElementById('status').remove();const host=document.getElementById('pages');for(let number=1;number<=pdf.numPages;number++){const page=await pdf.getPage(number);const initial=page.getViewport({scale:1});const cssWidth=Math.min(window.innerWidth-24,820);const cssScale=cssWidth/initial.width;const pixelRatio=Math.min(window.devicePixelRatio||1,2);const viewport=page.getViewport({scale:cssScale*pixelRatio});const canvas=document.createElement('canvas');canvas.className='page';canvas.width=Math.floor(viewport.width);canvas.height=Math.floor(viewport.height);canvas.style.width=Math.floor(viewport.width/pixelRatio)+'px';canvas.style.height=Math.floor(viewport.height/pixelRatio)+'px';host.appendChild(canvas);await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;}send({ready:true,pages:pdf.numPages});}catch(error){document.getElementById('status').textContent=error?.message||'Could not open this PDF.';send({error:error?.message||'Could not open this PDF.'});}</script></body></html>`;
  }, [assignment, viewerToken]);

  const saveCopy = async () => {
    if (!assignment || saving) return;
    setSaving(true);
    try {
      await saveAssignmentHighlightsPdf(assignment.id, assignment.topic || assignment.title, highlights.length);
      Alert.alert('PDF copy saved', 'Your revision PDF was saved to the folder you selected.');
    } catch (reason) { Alert.alert('Could not save PDF', reason instanceof Error ? reason.message : 'Please try again.'); }
    finally { setSaving(false); }
  };

  return <ScreenShell greeting={assignment?.subject?.toUpperCase() || 'REVISION NOTES'} title={assignment?.topic || assignment?.title || 'Revision Notes'} subtitle={assignment ? `${highlights.length} saved highlight${highlights.length === 1 ? '' : 's'}` : undefined} right={<BackButton />} testID="revision-note-detail">
    {loading ? <Text style={styles.message}>Opening your notes…</Text> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {!loading && !error ? <>
      <PressableCard style={styles.summary}><View style={styles.summaryIcon}><Feather name="file-text" size={17} color="#FFF" /></View><View style={{ flex: 1 }}><Text style={styles.summaryTitle}>Saved in your Aroha library</Text><Text style={styles.message}>Private PDF · {highlights.length} highlight{highlights.length === 1 ? '' : 's'}</Text></View></PressableCard>
      {viewerHtml ? <View style={styles.viewer}><WebView originWhitelist={['*']} source={{ html: viewerHtml, baseUrl: backendBase() }} javaScriptEnabled domStorageEnabled nestedScrollEnabled onMessage={(event) => { try { const message = JSON.parse(event.nativeEvent.data); if (message.error) setViewerError(message.error); } catch {} }} onError={() => setViewerError('The PDF viewer could not be loaded.')} /></View> : null}
      {viewerError ? <Text style={styles.error}>{viewerError}</Text> : null}
      <PrimaryButton label="Save PDF copy to Downloads" onPress={saveCopy} loading={saving} variant="secondary" style={{ marginTop: spacing.lg }} testID="revision-download" />
    </> : null}
  </ScreenShell>;
}

const styles = StyleSheet.create({
  summary: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.brandSoft },
  summaryIcon: { width: 40, height: 40, borderRadius: 13, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.brand },
  summaryTitle: { fontSize: 13, fontWeight: '800', color: colors.onSurface },
  message: { marginTop: 3, fontSize: 12, lineHeight: 17, color: colors.onSurfaceMuted },
  viewer: { height: 620, marginTop: spacing.md, overflow: 'hidden', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: '#EEEAE4' },
  error: { fontSize: 12, fontWeight: '600', color: '#8A3B18' },
});
