let map = L.map('map');
let hash = new L.Hash(map);

let custom_attribution = `<a href="https://wiki.openstreetmap.org/wiki/Is_OSM_up-to-date">${document.title}</a> (<a href="https://github.com/frafra/is-osm-uptodate">source code</a>)`;
let OpenStreetMapLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: `${custom_attribution} | &copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap contributors</a>`,
  maxZoom: 19,
  minZoom: 1
});

OpenStreetMapLayer.addTo(map);

let colour = 0;
let style = document.createElement('style');
document.head.appendChild(style);
map.whenReady(applyColor);
function applyColor() {
  while (style.sheet.cssRules.length) {
    style.sheet.deleteRule(0);
  }
  style.sheet.insertRule(`.leaflet-tile-container { filter: grayscale(${100-colour}%); }`, 0);
}

function setColor(event) {
  colour = event.target.value;
  applyColor();
}

document.getElementById('fetch').onclick = getData;
document.getElementById('go').onclick = event => {
  let text = document.getElementById('search').value;
  fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${text}&limit=1`).then(response => {
    return response.json();
  }).then(result => {
    let place = result[0];
    let corner1 = L.latLng(place.boundingbox[0], place.boundingbox[2]);
    let corner2 = L.latLng(place.boundingbox[1], place.boundingbox[3]);
    let boundingbox = L.latLngBounds(corner1, corner2);
    map.fitBounds(boundingbox);
  }).catch(error => {
    console.log(error);
  });
}

let mode = 'lastedit';
let buttonModes = document.querySelectorAll('#mode input');
for (let i=0; i<buttonModes.length; i++) {
  buttonModes[i].onchange = event => {
    mode = event.target.id;
    parseData();
  }
}
let modes = {
    lastedit: {
        defaultValue: new Date(),
        getValue: feature => new Date(feature.properties.timestamp),
        prettyValue: date => date.toISOString().slice(0, 10),
        inverted: false
    },
    creation: {
        defaultValue: new Date(),
        getValue: feature => new Date(feature.properties.created),
        prettyValue: date => date.toISOString().slice(0, 10),
        inverted: false
    },
    revisions: {
        defaultValue: 1,
        getValue: feature => feature.properties.version,
        prettyValue: value => value,
        inverted: false
    },
    contributors: {
        defaultValue: 1,
        getValue: feature => feature.properties.contributors,
        prettyValue: value => value,
        inverted: false
    },
    frequency: {
        defaultValue: 0,
        getValue: feature => {
          let milliseconds = new Date()-new Date(feature.properties.created)
          return milliseconds/1000/60/60/24/feature.properties.version;
        },
        prettyValue: value => {
          let days = Math.floor(value);
          if (days < 1) return 'daily';
          if (days < 365) return `every ${days} days`;
          let years = Math.floor(value/365);
          return `every ${years} year(s)`;
        },
        inverted: true
    }
}

let minimumValue = modes[mode].defaultValue;
let maximumValue = modes[mode].defaultValue;
let info = L.control();
info.onAdd = map => {
  this.div = L.DomUtil.create('div', 'info');
  L.DomEvent.disableClickPropagation(this.div);
  return this.div;
};
info.update = message => {
  if (!modes[mode].inverted) {
    minimumValuePretty = modes[mode].prettyValue(minimumValue);
    maximumValuePretty = modes[mode].prettyValue(maximumValue);
  } else {
    minimumValuePretty = modes[mode].prettyValue(maximumValue);
    maximumValuePretty = modes[mode].prettyValue(minimumValue);
  }
  this.div.innerHTML = `
    ${message}
    <strong style="text-align: center" class="d-block d-sm-block d-md-none">
      ${mode}
    </strong>
    <div class="bar">
      <span>${minimumValuePretty}</span>
      <span class="colors"></span>
      <span>${maximumValuePretty}</span>
    </div>
    <div class="slider d-none d-md-block">
      <hr/>
      Colour
      <input type="range" id="grayscale" value="${colour}"/>
    </div>
  `;
  document.getElementById('grayscale').addEventListener('input', setColor);
};
info.addTo(map);

let nodes = L.layerGroup();
let ways = L.layerGroup();
let rectangle = L.layerGroup();

let overlays = {
  '<i class="fas fa-dot-circle"></i> <span class="d-none d-md-inline">Nodes</span>':nodes,
  '<i class="fas fa-road"></i> <span class="d-none d-md-inline">Ways</span>':ways,
}
L.control.layers({}, overlays, {collapsed:false}).addTo(map);
nodes.addTo(map);

function openNodeMarker() {
  nodes.addTo(map);
  window.nodeMarker.openPopup();
}

function openWayMarker() {
  ways.addTo(map);
  window.wayMarker.openPopup();
}

function generatePopup(feature) {
  let attributes_list = `<ul>`;
  for (let key in feature.properties.attributes) {
    let value = feature.properties.attributes[key];
    attributes_list += `<li><a href="https://wiki.openstreetmap.org/wiki/Key:${key}" target="_blank">${key}</a>:
     <a href="https://wiki.openstreetmap.org/wiki/Tag:${key}%3D${value}" target="_blank">${value}</a></li>`;
  }
  attributes_list += `</ul>`;
  let position = location.hash.substr(1);
  let type = feature.geometry.type == 'Point' ? 'node' : 'way';
  let popup = `
    <b>Last edit</b>: ${feature.properties.timestamp} (by
      <a href="https://www.openstreetmap.org/user/${feature.properties.user}" target="_blank">${feature.properties.user}</a>)<br>
    <b>Created at</b>: ${feature.properties.created} (by
      <a href="https://www.openstreetmap.org/user/${feature.properties.users[0]}" target="_blank">${feature.properties.users[0]}</a>)<br>
    <b>Current version</b>: ${feature.properties.version}<br>
    <b>Contributors</b>: ${feature.properties.contributors}<br>
    <b>Attributes:</b>
      ${attributes_list}
    <br>
    <div style="text-align: center">
      <a href="https://www.openstreetmap.org/edit?${type}=${feature.properties.id}#map=${position}" target="_blank">Edit <a> |
      <a href="https://www.openstreetmap.org/${type}/${feature.properties.id}/history" target="_blank">History</a> |
      <a href="https://www.openstreetmap.org/${type}/${feature.properties.id}" target="_blank">Details<a>
    </div>
  `;
  return popup;
}

let bounds;
function getData() {
  info.update(`
    <div style="text-align: center">
      <strong>Loading</strong>
      <div>Please wait...</div>
    </div>`
  );
  bounds = map.getBounds();
  let west = bounds.getWest();
  let south = bounds.getSouth();
  let east = bounds.getEast();
  let north = bounds.getNorth();
  let url = `/api/getData?minx=${west}&miny=${south}&maxx=${east}&maxy=${north}`;
  fetch(url).then(response => {
    return response.json();
  }).then(parseData).catch(error => {
    info.update(`
      <div style="text-align: center">
        <strong>Error</strong>
        <div>Please try again or zoom in.</div>
      </div>
    `);
    console.log(error);
  });
}

let results;
function parseData(data) {
  results = data ? data : results;
  nodes.clearLayers();
  ways.clearLayers();
  rectangle.remove();
  minimumValue = modes[mode].defaultValue;
  maximumValue = modes[mode].defaultValue;
  let minimumNodeValue = modes[mode].defaultValue;
  let minimumWayValue = modes[mode].defaultValue;
  let maximumNodeValue = modes[mode].defaultValue;
  let maximumWayValue = modes[mode].defaultValue;
  let minimumNode;
  let minimumWay;
  let maximumNode;
  let maximumWay;
  let defaultValue = modes[mode].defaultValue
  for (let index in results.features) {
    let feature = results.features[index];
    let value = modes[mode].getValue(feature);
    if (feature.geometry.type == 'Point') {
      if (value <= minimumNodeValue || minimumNodeValue == defaultValue) {
        minimumNodeValue = value;
        minimumNode = feature;
      }
      if (value > maximumNodeValue || maximumNodeValue == defaultValue) {
        maximumNodeValue = value;
        maximumNode = feature;
      }
    } else {
      if (value <= minimumWayValue || minimumWayValue == defaultValue) {
        minimumWayValue = value;
        minimumWay = feature;
      }
      if (value > maximumWayValue || maximumWay == defaultValue) {
        maximumWayValue = value;
        maximumWay = feature;
      }
    }
    if (value <= minimumValue) {
      minimumValue = value;
    }
    if (value > maximumValue) {
      maximumValue = value;
    }
  }
  let nodePrettyValue;
  let wayPrettyValue;
  let nodePrettyId;
  let wayPrettyId;
  if (!modes[mode].inverted) {
    nodePrettyValue = modes[mode].prettyValue(modes[mode].getValue(minimumNode));
    wayPrettyValue = modes[mode].prettyValue(modes[mode].getValue(minimumWay));
    nodePrettyId = minimumNode.properties.id;
    wayPrettyId = minimumWay.properties.id;
  } else {
    nodePrettyValue = modes[mode].prettyValue(modes[mode].getValue(maximumNode));
    wayPrettyValue = modes[mode].prettyValue(modes[mode].getValue(maximumWay));
    nodePrettyId = maximumNode.properties.id;
    wayPrettyId = maximumWay.properties.id;
  }
  info.update(`
    <table class="d-none d-md-table">
      <tr>
        <td>Worst node</td>
        <td><a href="javascript:openNodeMarker();">#${nodePrettyId}</a></td>
        <td>(${nodePrettyValue})</td>
      </tr>
      <tr>
        <td>Worst way</td>
        <td><a href="javascript:openWayMarker();">#${wayPrettyId}</a></td>
        <td>(${wayPrettyValue})</td>
      </tr>
    </table>
  `);
  let range;
  if (modes[mode].inverted) range = minimumValue-maximumValue;
  else range = maximumValue-minimumValue;
  L.geoJSON(results, {
    pointToLayer: (feature, latlng) => {
      let value = modes[mode].getValue(feature);
      let computed;
      if (modes[mode].inverted) computed = (value-maximumValue)/range
      else computed = (value-minimumValue)/range;
      let marker = L.circleMarker(latlng, {
        radius: 5,
        fillColor: d3.interpolateViridis(computed),
        color: "#555",
        weight: 1,
        opacity: 1,
        fillOpacity: 1
      });
      let popup = generatePopup(feature);
      marker.bindPopup(popup);
      if (!modes[mode].inverted) {
        if (feature.properties.id == minimumNode.properties.id) {
          window.nodeMarker = marker;
        }
      } else {
        if (feature.properties.id == maximumNode.properties.id) {
          window.nodeMarker = marker;
        }
      }
      nodes.addLayer(marker);
      return marker;
    },
    onEachFeature: (feature, layer) => {
      if (feature.geometry.type !== 'LineString') return;
      let value = modes[mode].getValue(feature);
      let computed;
      if (modes[mode].inverted) computed = (value-maximumValue)/range
      else computed = (value-minimumValue)/range;
      layer.options.color = d3.interpolateViridis(computed);
      let popup = generatePopup(feature);
      layer.bindPopup(popup);
      if (!modes[mode].inverted) {
        if (feature.properties.id == minimumWay.properties.id) {
          window.wayMarker = layer;
        }
      } else {
        if (feature.properties.id == maximumWay.properties.id) {
          window.wayMarker = layer;
        }
      }
      ways.addLayer(layer);
    }
  });
  rectangle = L.rectangle(bounds, {
    color: "#ff7800", fill: false, weight: 3
  });
  rectangle.addTo(map);
}

if (!document.location.hash) {
  map.setView([45.46423, 9.19073], 19); // Duomo di Milano
  getData();
}

map.on('load', getData);
