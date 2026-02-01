import { Request, Response } from 'express';
import { fetchExternalData } from './external.service';

export async function getExternalData(
  _req: Request,
  res: Response
) {
  try {
    const data = await fetchExternalData();
    res.json({ data });
  } catch (err) {
    res.status(502).json({
      message: 'Failed to fetch external data'
    });
  }
}
