import {createContext,useContext} from 'react';
export const PropertyFactReviewContext=createContext(null);
export const usePropertyFactReview=()=>useContext(PropertyFactReviewContext);
