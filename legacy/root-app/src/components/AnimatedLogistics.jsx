import React from "react";

export default function AnimatedLogistics() {
  return <div className="scene" aria-hidden="true">
    <div className="scene-glow glow-one" /><div className="scene-glow glow-two" />
    <div className="skyline skyline-back"><i/><i/><i/><i/><i/><i/><i/></div>
    <div className="mountain mountain-one" /><div className="mountain mountain-two" />
    <svg className="route-map" viewBox="0 0 800 420" preserveAspectRatio="none">
      <path className="route route-dash" d="M-30 310 C130 250 140 365 290 290 S480 185 570 230 S700 100 840 140" />
      <path className="route route-glow" d="M-30 310 C130 250 140 365 290 290 S480 185 570 230 S700 100 840 140" />
      <circle className="route-dot dot-a" cx="290" cy="290" r="5"/><circle className="route-dot dot-b" cx="570" cy="230" r="5"/><circle className="route-dot dot-c" cx="700" cy="145" r="5"/>
    </svg>
    <div className="road"><div className="road-line"/></div>
    <div className="truck truck-one"><span className="truck-trailer"/><span className="truck-cab"/><i className="wheel wheel-a"/><i className="wheel wheel-b"/><i className="wheel wheel-c"/></div>
    <div className="truck truck-two"><span className="truck-trailer"/><span className="truck-cab"/><i className="wheel wheel-a"/><i className="wheel wheel-b"/><i className="wheel wheel-c"/></div>
    <div className="scene-caption"><span className="live-dot"/> GOODS MOVING. PEOPLE CONNECTING.</div>
  </div>;
}
