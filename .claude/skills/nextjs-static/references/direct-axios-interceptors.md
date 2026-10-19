# Direct Axios HTTP Client & Interceptors Recipe

Complete setup for `directHttpClient` connecting a static Next.js SPA directly to remote Backend APIs.

## 1. Setup in `src/shared/utils/request.ts`

```typescript
import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';

export const directHttpClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Request Interceptor: Attach Bearer Token from LocalStorage
directHttpClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('access_token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401 Unauthorized & Session Termination
directHttpClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      const currentPath = window.location.pathname;
      if (!currentPath.startsWith('/login')) {
        window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
      }
    }
    return Promise.reject(error);
  }
);
```

## 2. Using with Feature Repositories

```typescript
// src/modules/products/infrastructure/repositories/product-repository.ts
import { directHttpClient } from '@/shared/utils/request';
import type { IProductRepository } from '../../domain/product-repository-interface';
import { mapProductDtoToViewModel } from '../mappers/product-mapper';

export const productRepository: IProductRepository = {
  async getProducts(signal?: AbortSignal) {
    const res = await directHttpClient.get('/v1/products', { signal });
    return res.data.data.map(mapProductDtoToViewModel);
  },
  async createProduct(data, signal?: AbortSignal) {
    const res = await directHttpClient.post('/v1/products', data, { signal });
    return mapProductDtoToViewModel(res.data.data);
  },
};
```
