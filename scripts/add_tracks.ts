import { Client } from '@replit/object-storage';
import { db } from '../server/db';
import { audioTracks } from '../shared/schema';

const DOMAIN = process.env.REPLIT_DEV_DOMAIN || 'localhost';

function parseTrackInfo(filename: string) {
  const parts = filename.split('/');
  const category = parts[0];
  const basename = parts[1].replace('.wav', '');
  
  const match = basename.match(/([A-Za-z]+)BinauralBeat_(\d+)_(-?\d+-?\d*)_(.+)/);
  if (!match) return null;
  
  const [_, prefix, baseFreq, beatFreq, title] = match;
  const cleanBeat = beatFreq.replace('-', '.');
  
  const cleanTitle = title
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/&/g, ' & ')
    .replace(/  +/g, ' ')
    .trim();
  
  return {
    category,
    baseFreq: parseInt(baseFreq),
    beatFreq: parseFloat(cleanBeat),
    title: cleanTitle,
    filename
  };
}

async function main() {
  const client = new Client();
  const result = await client.list();
  const files = (result as any).value || [];
  
  const categories = ['Theta', 'Alpha', 'Beta', 'Gamma'];
  let inserted = 0;
  
  for (const cat of categories) {
    const tracks = files.filter((f: any) => f.name.startsWith(cat + '/'));
    console.log(`\nProcessing ${cat} (${tracks.length} tracks)...`);
    
    for (const file of tracks) {
      const info = parseTrackInfo(file.name);
      if (!info) {
        console.log(`  Skipping (could not parse): ${file.name}`);
        continue;
      }
      
      const fileUrl = `https://${DOMAIN}:5000/api/audio/stream/${encodeURIComponent(file.name)}`;
      
      try {
        await db.insert(audioTracks).values({
          title: info.title,
          category: info.category,
          frequency: `${info.baseFreq}Hz base, ${info.beatFreq}Hz beat`,
          duration: 1800,
          fileUrl: fileUrl,
        });
        console.log(`  Added: ${info.title}`);
        inserted++;
      } catch (err: any) {
        console.log(`  Error adding ${info.title}: ${err.message}`);
      }
    }
  }
  
  console.log(`\nDone! Inserted ${inserted} tracks.`);
  process.exit(0);
}

main().catch(console.error);
