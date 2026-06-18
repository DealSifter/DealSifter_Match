import { useContext } from 'react';
import { GuideTipsContext } from './GuideTipsContext';

export const useGuideTips = () => useContext(GuideTipsContext);
