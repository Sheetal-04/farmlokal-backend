import { Request, Response, NextFunction } from 'express';
import { listProducts, ProductQueryParams } from './product.service';

export async function getProducts(req: Request, res: Response, next: NextFunction) {
  try {
    const params: ProductQueryParams = {
      limit: req.query.limit as string | undefined,
      cursor: req.query.cursor as string | undefined,
      sortBy: req.query.sortBy as string | undefined,
      sortOrder: req.query.sortOrder as string | undefined,
      category: req.query.category as string | undefined,
      minPrice: req.query.minPrice as string | undefined,
      maxPrice: req.query.maxPrice as string | undefined,
      q: req.query.q as string | undefined,
    };

    const result = await listProducts(params);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
