import { db } from "./db";
import { audioTracks } from "../shared/schema";

const sampleTracks = [
  {
    title: "Deep Sleep Delta",
    description: "Experience deep restorative sleep with 2Hz delta waves",
    frequency: "2 Hz",
    category: "Delta",
    duration: 1800,
    fileUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  },
  {
    title: "Healing Delta",
    description: "Promote physical healing and rejuvenation",
    frequency: "3 Hz",
    category: "Delta",
    duration: 2400,
    fileUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
  },
  {
    title: "Deep Meditation Theta",
    description: "Enter profound meditative states with 6Hz theta waves",
    frequency: "6 Hz",
    category: "Theta",
    duration: 1500,
    fileUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
  },
  {
    title: "Creative Visualization",
    description: "Enhance creativity and visualization abilities",
    frequency: "7 Hz",
    category: "Theta",
    duration: 1200,
    fileUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
  },
  {
    title: "Lucid Dreams",
    description: "Promote vivid and lucid dreaming experiences",
    frequency: "5 Hz",
    category: "Theta",
    duration: 2700,
    fileUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3",
  },
  {
    title: "Calm Relaxation",
    description: "Gentle relaxation with 10Hz alpha waves",
    frequency: "10 Hz",
    category: "Alpha",
    duration: 900,
    fileUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3",
  },
  {
    title: "Stress Relief",
    description: "Reduce anxiety and promote calm awareness",
    frequency: "11 Hz",
    category: "Alpha",
    duration: 1200,
    fileUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-7.mp3",
  },
  {
    title: "Light Meditation",
    description: "Perfect for beginners to meditation practice",
    frequency: "9 Hz",
    category: "Alpha",
    duration: 1500,
    fileUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-8.mp3",
  },
  {
    title: "Focus Boost",
    description: "Enhanced concentration with 18Hz beta waves",
    frequency: "18 Hz",
    category: "Beta",
    duration: 1800,
    fileUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-9.mp3",
  },
  {
    title: "Study Session",
    description: "Maintain alertness during study sessions",
    frequency: "20 Hz",
    category: "Beta",
    duration: 2400,
    fileUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-10.mp3",
  },
  {
    title: "Active Mind",
    description: "Stay mentally sharp and active",
    frequency: "15 Hz",
    category: "Beta",
    duration: 1200,
    fileUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-11.mp3",
  },
  {
    title: "Peak Performance",
    description: "High-frequency gamma for peak mental performance",
    frequency: "40 Hz",
    category: "Gamma",
    duration: 900,
    fileUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-12.mp3",
  },
  {
    title: "Enhanced Memory",
    description: "Boost memory recall and cognitive function",
    frequency: "38 Hz",
    category: "Gamma",
    duration: 1200,
    fileUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-13.mp3",
  },
];

async function seed() {
  console.log("Seeding audio tracks...");
  
  for (const track of sampleTracks) {
    try {
      await db.insert(audioTracks).values(track);
      console.log(`Added: ${track.title}`);
    } catch (error: any) {
      if (error.message?.includes("duplicate")) {
        console.log(`Skipped (already exists): ${track.title}`);
      } else {
        console.error(`Error adding ${track.title}:`, error.message);
      }
    }
  }
  
  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch(console.error);
