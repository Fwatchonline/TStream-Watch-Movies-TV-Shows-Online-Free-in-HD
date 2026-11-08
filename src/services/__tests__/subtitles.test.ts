import assert from 'assert';
import { normalizeLanguageCode } from '../subtitles';

function parseSubtitlesText(raw: string) {
  const list: Array<{ start: number; end: number; text: string }> = [];
  const clean = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = clean.split('\n');
  const timeRegex = /(?:(\d+):)?(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(?:(\d+):)?(\d{2}):(\d{2})[,.](\d{3})/;

  const parseTimestamp = (h?: string, m?: string, s?: string, ms?: string) => {
    const hours = parseInt(h || '0', 10);
    const mins = parseInt(m || '0', 10);
    const secs = parseInt(s || '0', 10);
    const millis = parseInt(ms || '0', 10);
    return hours * 3600 + mins * 60 + secs + millis / 1000;
  };

  let currentCue: { start: number; end: number; textLines: string[] } | null = null;
  const commitCue = () => {
    if (currentCue && currentCue.textLines.length) {
      const text = currentCue.textLines.join('\n').trim();
      if (text && currentCue.end > currentCue.start) {
        list.push({ start: currentCue.start, end: currentCue.end, text });
      }
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    if (line.startsWith('WEBVTT') || line.startsWith('NOTE') || line.startsWith('STYLE') || line.startsWith('REGION')) continue;

    const match = line.match(timeRegex);
    if (match) {
      commitCue();
      const start = parseTimestamp(match[1], match[2], match[3], match[4]);
      const end = parseTimestamp(match[5], match[6], match[7], match[8]);
      currentCue = { start, end, textLines: [] };
    } else if (currentCue) {
      let isCueNumber = /^\d+$/.test(line);
      if (isCueNumber) {
        let j = i + 1;
        while (j < lines.length && !lines[j].trim()) j++;
        if (j < lines.length && lines[j].includes('-->')) {
          continue;
        }
      }
      const cleanLine = line.replace(/<[^>]+>/g, '').trim();
      if (cleanLine) {
        currentCue.textLines.push(cleanLine);
      }
    }
  }
  commitCue();
  return list;
}

console.log('--- Running Subtitle Parsing & Encoding Tests ---');

// Test 1: Standard WebVTT with 3-part timestamps and cue settings
const vtt1 = `WEBVTT

00:00:01.500 --> 00:00:04.200 line:80% position:50%
Dobrodošli u novi video!
Pratite sa prevodom.

00:00:05.000 --> 00:00:08.750
Uživajte u gledanju.`;

const cues1 = parseSubtitlesText(vtt1);
assert.strictEqual(cues1.length, 2, 'Should parse 2 cues');
assert.strictEqual(cues1[0].start, 1.5);
assert.strictEqual(cues1[0].end, 4.2);
assert.strictEqual(cues1[0].text, 'Dobrodošli u novi video!\nPratite sa prevodom.');
console.log('PASS: WebVTT with cue settings and multi-line text parsed correctly');

// Test 2: Standard SRT with cue numbers and comma separators
const srt1 = `1
00:01:10,250 --> 00:01:13,800
<i>Ovo je prevod na srpski / hrvatski / bosanski.</i>

2
00:01:15,000 --> 00:01:18,500
Sve funkcioniše savršeno!`;

const cues2 = parseSubtitlesText(srt1);
assert.strictEqual(cues2.length, 2, 'Should parse 2 SRT cues');
assert.strictEqual(cues2[0].start, 70.25);
assert.strictEqual(cues2[0].end, 73.8);
assert.strictEqual(cues2[0].text, 'Ovo je prevod na srpski / hrvatski / bosanski.');
console.log('PASS: SRT format with HTML tags stripped parsed correctly');

// Test 3: Real OpenSubtitles format with NO empty lines between cues
const srtTight = `1
00:02:28,699 --> 00:02:31,699
Ljudi me stalno pitaju
Da li znam Tajlera Durdena.
2
00:02:32,780 --> 00:02:33,579
Tri minuta.
3
00:02:33,659 --> 00:02:35,900
To je to. Početak i kraj.`;

const cuesTight = parseSubtitlesText(srtTight);
assert.strictEqual(cuesTight.length, 3, 'Should parse all 3 tight cues without empty lines');
assert.strictEqual(cuesTight[0].text, 'Ljudi me stalno pitaju\nDa li znam Tajlera Durdena.');
assert.strictEqual(cuesTight[1].text, 'Tri minuta.');
assert.strictEqual(cuesTight[2].text, 'To je to. Početak i kraj.');
console.log('PASS: Real OpenSubtitles format without empty lines parsed all cues correctly');

// Test 4: WebVTT with BOM (\uFEFF)
const bomVtt = `\uFEFFWEBVTT

00:00:10.000 --> 00:00:12.000
BOM handled cleanly`;

const cues3 = parseSubtitlesText(bomVtt);
assert.strictEqual(cues3.length, 1, 'Should handle BOM prefix');
assert.strictEqual(cues3[0].text, 'BOM handled cleanly');
console.log('PASS: BOM prefix handled cleanly');

// Test 5: Windows-1250 encoding transcoding
const cp1250Bytes = Buffer.from([0xe8, 0xe6, 0x9a, 0x9e, 0xf0]); // č, ć, š, ž, đ in CP1250
const decodedCp1250 = new TextDecoder('windows-1250').decode(cp1250Bytes);
assert.strictEqual(decodedCp1250, 'čćšžđ', 'Should decode Windows-1250 diacritics');
console.log('PASS: Windows-1250 Ex-Yu diacritics decoded correctly: ' + decodedCp1250);

// Test 6: OpenSubtitles 3-letter language code normalization
const srp = normalizeLanguageCode('srp');
const hrv = normalizeLanguageCode('hrv');
const bos = normalizeLanguageCode('bos');
const eng = normalizeLanguageCode('eng');
assert.strictEqual(srp.normalizedCode, 'sr');
assert.strictEqual(hrv.normalizedCode, 'hr');
assert.strictEqual(bos.normalizedCode, 'bs');
assert.strictEqual(eng.normalizedCode, 'en');
console.log('PASS: OpenSubtitles 3-letter codes normalized properly (srp->sr, hrv->hr, bos->bs, eng->en)');

console.log('ALL SUBTITLE TESTS PASSED SUCCESSFULLY (6/6)');
