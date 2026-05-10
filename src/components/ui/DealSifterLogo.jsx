import logo from '../../assets/logo.png';
import { SmartImage } from './SmartImage';

export const DealSifterLogo = ({ size=28 }) => (
  <SmartImage
    src={logo} 
    alt="DealSifter Logo" 
    style={{ width: size, height: size, objectFit: "contain" }} 
  />
);
