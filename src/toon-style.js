import * as THREE from 'three';

// Three discrete light bands, sampled without interpolation.
const bands = new THREE.DataTexture(new Uint8Array([45, 125, 255]), 3, 1, THREE.RedFormat);
bands.minFilter = bands.magFilter = THREE.NearestFilter;
bands.generateMipmaps = false;
bands.needsUpdate = true;

export function toonMaterial(color, options = {}) {
  return new THREE.MeshToonMaterial({ color, gradientMap: bands, ...options });
}

export function facetedGeometry(geometry) {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  flat.computeVertexNormals();
  return flat;
}

export function inkEdges(mesh, threshold = 25) {
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry, threshold),
    new THREE.LineBasicMaterial({ color: 0x101827, transparent: true, opacity: 0.85 }),
  );
  mesh.add(edges);
  return edges;
}
