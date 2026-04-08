import type { VercelRequest, VercelResponse } from '@vercel/node';
import { NexusEngineUltra } from '../src/lib/nexus';

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  NexusEngineUltra.clearCache();
  res.status(200).json({ success: true });
}
