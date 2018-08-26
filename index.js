const FileSaver = require('file-saver');
const StaticMap = require('@rz0/static-map');

const EARTH_RADIUS_WGS84 = 6378137;

function getMetersPerPixel(options) {
    const { lat, zoom } = options;
    return 2 * Math.PI * EARTH_RADIUS_WGS84 * Math.cos(lat * Math.PI / 180) / 2 ** (zoom + 8);
}

async function loadImageData(options) {
    const { lon, lat, zoom, size, url } = options;
    const staticMap = new StaticMap([url]);
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    return new Promise((resolve) => {
        staticMap.getMap(canvas, lon, lat, zoom, () => {
            const ctx = canvas.getContext('2d');
            const imageData = ctx.getImageData(0, 0, size, size);
            resolve(imageData);
        });
    });
}

function parseImageData(imageData) {
    const { data, width, height } = imageData;
    const elevations = new Float32Array(width * height);
    for (let i = 0; i < data.length / 4; i += 1) {
        const r = data[i * 4];
        const g = data[i * 4 + 1];
        const b = data[i * 4 + 2];
        elevations[i] = -10000 + ((r * 256 * 256 + g * 256 + b) * 0.1);
    }
    return { elevations, width, height };
}

function makeMesh(heightMap, metersPerPixel) {
    const { elevations, width, height } = heightMap;
    const vertices = [];
    const faces = [];
    const textureCoordinates = [];
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const index = (height - 1 - y) * width + x;
            const z = elevations[index] / metersPerPixel;
            vertices.push([x, y, z]);
            textureCoordinates.push([x / (width - 1), y / (height - 1)]);
        }
    }
    for (let x = 0; x < width - 1; x += 1) {
        for (let y = 0; y < height - 1; y += 1) {
            const v0 = y * width + x + 1;
            const v1 = v0 + 1;
            const v2 = v0 + width;
            const v3 = v2 + 1;
            faces.push([v0, v1, v2]);
            faces.push([v2, v1, v3]);
        }
    }
    return { vertices, textureCoordinates, faces };
}

function meshToObj(mesh) {
    const { vertices, textureCoordinates, faces } = mesh;
    const header = '# terrain-to-obj\nmtllib material.mtl\nusemtl texture';
    const verticesObj = vertices.map(vertice => `v ${vertice.join(' ')}`).join('\n');
    const textureCoordinatesObj = textureCoordinates.map(
        textureCoordinate => `vt ${textureCoordinate.join(' ')}`
    ).join('\n');
    const facesObj = faces.map((face) => {
        const elements = face.map(index => `${index}/${index}`);
        return `f ${elements.join(' ')}`
    }).join('\n');
    return `${header}\n${verticesObj}\n${textureCoordinatesObj}\n${facesObj}\n`;
}

function saveTextFile(filename, content) {
    const blob = new Blob([content], {type: "text/plain;charset=utf-8"});
    FileSaver.saveAs(blob, filename);
}

async function loadTerrain(options) {
    const metersPerPixel = getMetersPerPixel(options);
    const imageData = await loadImageData(options);
    const heightMap = parseImageData(imageData);
    const mesh = makeMesh(heightMap, metersPerPixel);
    const obj = meshToObj(mesh);
    saveTextFile('mesh.obj', obj);
}

const options = {
    lon: 7.6497,
    lat: 45.9766,
    zoom: 13,
    size: 1024,
    url: 'https://api.mapbox.com/v4/mapbox.terrain-rgb/{z}/{x}/{y}.pngraw?access_token=pk.eyJ1IjoibmhvZmVyIiwiYSI6ImNqZHViYWNnMjJzbXIyd3Q3MGI4emU5ZTAifQ.AKITUlaDoEzIkU2SGn6e1A',
}

loadTerrain(options);
