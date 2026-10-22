import React from "react";
import { useLocation } from "react-router-dom";
import { Boxes, Factory, Package, Truck, Waypoints } from "lucide-react";
import "./RoleBackground.css";

function roleFromPath(path) {
  if (path.startsWith("/factory/")) return "factory";
  if (path.startsWith("/transporter/")) return "transporter";
  if (path.startsWith("/broker/")) return "broker";
  return "auth";
}

export default function RoleBackground() {
  const { pathname } = useLocation();
  const role = roleFromPath(pathname);
  const feature = pathname.split("/").filter(Boolean)[1] || "dashboard";
  if (role === "auth") return null;
  return <div className={`loadsetu-scene scene-${role} scene-feature-${feature}`} aria-hidden="true">
    <div className="scene-grid"/><div className="scene-orb orb-one"/><div className="scene-orb orb-two"/>
    {role === "factory" && <>
      <div className="factory-shed"><Factory size={58}/><div className="shed-windows"><i/><i/><i/><i/></div><span className="smoke smoke-one"/><span className="smoke smoke-two"/></div>
      <div className="factory-belt"><i/><i/><i/><i/><i/><i/><i/><i/></div>
      <div className="factory-box box-one"><Package/></div><div className="factory-box box-two"><Boxes/></div><div className="factory-box box-three"><Package/></div>
      <div className="factory-forklift"><b/><i/><i/></div><div className="scene-caption">FACTORY · PACKING · DISPATCH</div>
    </>}
    {role === "transporter" && <>
      <div className="transport-road"><i/><i/><i/><i/><i/><i/></div><div className="transport-route route-one"/><div className="transport-route route-two"/>
      <div className="transport-truck truck-one"><b/><span/><i/><i/></div><div className="transport-truck truck-two"><b/><span/><i/><i/></div><div className="transport-pin pin-one">A</div><div className="transport-pin pin-two">B</div><div className="scene-caption">FLEET · ROUTES · DELIVERY</div>
    </>}
    {role === "broker" && <>
      <div className="broker-wire wire-one"/><div className="broker-wire wire-two"/><div className="broker-wire wire-three"/>
      <div className="broker-node broker-load"><Factory/><small>LOAD</small></div><div className="broker-node broker-match"><Waypoints/><small>MATCH</small></div><div className="broker-node broker-fleet"><Truck/><small>FLEET</small></div>
      <div className="broker-packet packet-one"/><div className="broker-packet packet-two"/><div className="broker-packet packet-three"/><div className="scene-caption">LOAD MATCHING · BOOKING · SHIPMENT</div>
    </>}
  </div>;
}
