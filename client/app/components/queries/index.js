import { clientConfig } from '@/services/auth';
import qs from 'qs';

export default {};

export const getQueryDataUrl = (queryId, format, apiKey = '', download = true) => {
  const params = {};
  if (apiKey) {
    params.api_key = apiKey;
  }
  if (download === false) {
    params.download = 'false';
  }
  const paramStr = qs.stringify(params);
  return `${clientConfig.basePath}api/queries/${queryId}/results.${format}${paramStr ? '?' + paramStr : ''}`;
};
