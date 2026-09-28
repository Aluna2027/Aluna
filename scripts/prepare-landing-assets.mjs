import { mkdir, access, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import path from 'node:path';

const assets = {
  'path-explore.jpg': 'https://images.unsplash.com/photo-1452421822248-d4c2b47f0c81?auto=format&fit=crop&w=1200&q=82',
  'path-connect.jpg': 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=82',
  'path-join.jpg': 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1200&q=82',
  'path-fund.jpg': 'https://images.unsplash.com/photo-1532629345422-7515f3d16bb6?auto=format&fit=crop&w=1200&q=82',
  'path-prove.jpg': 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1200&q=82',
  'companies.jpg': 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=82',
  'impact.jpg': 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=82',
  'join.jpg': 'https://images.unsplash.com/photo-1521295121783-8a321d551ad2?auto=format&fit=crop&w=1800&q=82',
};

const outDir = path.join(process.cwd(), 'public', 'landing');
await mkdir(outDir, { recursive: true });

for (const [name, url] of Object.entries(assets)) {
  const output = path.join(outDir, name);
  try {
    await access(output, constants.F_OK);
    continue;
  } catch {}
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${name}: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(output, buffer);
}
