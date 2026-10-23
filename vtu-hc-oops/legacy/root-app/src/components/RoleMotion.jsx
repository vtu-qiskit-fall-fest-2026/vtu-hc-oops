import React from "react";
import { Boxes, Factory, GitBranch, Package, Route, Truck, Waypoints } from "lucide-react";
import "./RoleMotion.css";

const scenes = {
  factory: {
    eyebrow: { en: "FACTORY OPERATIONS", mr: "कारखाना संचालन", hi: "फैक्टरी संचालन" },
    title: { en: "Goods moving from factory to dispatch", mr: "कारखान्यातून माल पाठवण्याची तयारी", hi: "फैक्टरी से माल भेजने की तैयारी" },
    sub: { en: "Track loads, packing and dispatch activity", mr: "माल, पॅकिंग आणि पाठवणीवर लक्ष ठेवा", hi: "माल, पैकिंग और डिस्पैच पर नज़र रखें" },
  },
  transporter: {
    eyebrow: { en: "TRANSPORT FLEET", mr: "वाहतूक ताफा", hi: "परिवहन बेड़ा" },
    title: { en: "Your fleet is ready for the next route", mr: "तुमचा ताफा पुढील मार्गासाठी तयार आहे", hi: "आपका वाहन बेड़ा अगले मार्ग के लिए तैयार है" },
    sub: { en: "Follow routes, availability and delivery progress", mr: "मार्ग, उपलब्धता आणि वितरणाची प्रगती पाहा", hi: "मार्ग, उपलब्धता और डिलीवरी की प्रगति देखें" },
  },
  broker: {
    eyebrow: { en: "SMART LOAD MATCHING", mr: "स्मार्ट लोड जुळवणी", hi: "स्मार्ट लोड मिलान" },
    title: { en: "Connecting the right load with the right truck", mr: "योग्य मालासाठी योग्य ट्रक जोडत आहोत", hi: "सही माल के लिए सही ट्रक जोड़ रहे हैं" },
    sub: { en: "Match goods owners, loads and transport partners", mr: "मालक, माल आणि वाहतूकदार यांना जोडा", hi: "माल मालिकों, लोड और ट्रांसपोर्टरों को जोड़ें" },
  },
};

export default function RoleMotion({ role = "factory", language }) {
  const scene = scenes[role] || scenes.factory;
  const lang = ["en", "mr", "hi"].includes(language) ? language : (localStorage.getItem("loadsetu-language") || "en");
  return <section className={`role-motion role-motion-${role}`} aria-label={scene.eyebrow[lang]}>
    <div className="rm-copy"><span className="rm-eyebrow"><i />{scene.eyebrow[lang]}</span><h2>{scene.title[lang]}</h2><p>{scene.sub[lang]}</p></div>
    <div className="rm-scene" aria-hidden="true">
      {role === "factory" && <>
        <div className="rm-factory-building"><Factory size={42}/><span className="rm-smoke rm-smoke-one"/><span className="rm-smoke rm-smoke-two"/></div>
        <div className="rm-belt"><i/><i/><i/><i/><i/><i/></div>
        <div className="rm-box rm-box-a"><Package size={19}/></div><div className="rm-box rm-box-b"><Boxes size={19}/></div>
        <div className="rm-loading-bay">DISPATCH <span/></div>
      </>}
      {role === "transporter" && <>
        <div className="rm-road"><i/><i/><i/><i/></div>
        <div className="rm-truck rm-truck-back"><span className="rm-truck-cargo"/><span className="rm-cab"/><i className="rm-wheel left"/><i className="rm-wheel right"/></div>
        <div className="rm-truck rm-truck-front"><span className="rm-truck-cargo"/><span className="rm-cab"/><i className="rm-wheel left"/><i className="rm-wheel right"/></div>
        <div className="rm-route-pin"><Route size={17}/></div>
      </>}
      {role === "broker" && <>
        <div className="rm-network-line line-one"/><div className="rm-network-line line-two"/><div className="rm-network-line line-three"/>
        <div className="rm-node rm-node-factory"><Factory size={22}/><span>LOAD</span></div>
        <div className="rm-node rm-node-match"><Waypoints size={22}/><span>MATCH</span></div>
        <div className="rm-node rm-node-truck"><Truck size={22}/><span>FLEET</span></div>
        <div className="rm-packet packet-one"/><div className="rm-packet packet-two"/><div className="rm-packet packet-three"/>
      </>}
    </div>
  </section>;
}
