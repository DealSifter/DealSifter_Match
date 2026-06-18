import { useContext } from 'react';
import { GuideTipsContext } from './GuideTipsProvider';

export const useGuideTips = () => useContext(GuideTipsContext);
