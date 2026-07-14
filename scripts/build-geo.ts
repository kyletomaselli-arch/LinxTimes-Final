import { readFileSync, writeFileSync } from "node:fs";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";

const topo = JSON.parse(readFileSync("public/geo/countries-110m.json", "utf8")) as Topology;
const fc = feature(topo, topo.objects.countries as GeometryCollection);
// fc is a FeatureCollection with one feature per country → continents render as dots.
writeFileSync("public/geo/land.geojson", JSON.stringify(fc));
const count = (fc as { features: unknown[] }).features.length;
console.log(`Wrote public/geo/land.geojson (${count} country features)`);
