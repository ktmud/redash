import { clientConfig } from '@/services/auth';

export default {};

export const getQueryDataUrl = (queryId, format, apiKey = '') => (
  `${clientConfig.basePath}api/queries/${queryId}/results.${format}${
    apiKey === false ? '' : ('?api_key=' + apiKey)
  }`
);
