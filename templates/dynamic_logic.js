


if (window.map) {
    window.map.createPane('top-layer-pane');
    window.map.getPane('top-layer-pane').style.zIndex = 650;
    window.map.getPane('top-layer-pane').style.pointerEvents = 'none';
    const coordTracker = L.control({ position: 'bottomleft' });

    coordTracker.onAdd = function (map) {
        this._div = L.DomUtil.create('div', 'coords-display');
        this.update();
        return this._div;
    };

    coordTracker.update = function (coords) {
        this._div.innerHTML = coords
            ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
            : '';
    };

    coordTracker.addTo(window.map);

    window.map.on('mousemove', function (e) {
        coordTracker.update(e.latlng);
    });

}

const damIcon = L.icon({
    iconUrl: '/static/dam.png',
    iconSize: [30, 30],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
});

function getFlowColor(regime) {
    switch (regime) {
        case 'Dam_regulated': return '#309E28';
        case 'Dam_affected': return '#e60b0bff';
        case 'Natural': return '#3197DB';
        case 'Natural_falls': return '#E67F23';
        default: return '#95a5a6';
    }
}

function initializeEmptyChart() {
    const layout = {
        title: {
            text: 'SWOT Analysis - Waiting for selection',
            font: {
                family: "'Segoe UI', Tahoma, sans-serif",
                size: 16,
                color: '#000000ff'
            }
        },

        xaxis: {
            showticklabels: false,
            showgrid: true,
            zeroline: false,
            title: { text: '' }
        },
        yaxis: {
            showticklabels: false,
            showgrid: true,
            zeroline: false,
            title: { text: '' }
        },
        autosize: true,
        margin: { t: 50, b: 20, l: 20, r: 20 },
        paper_bgcolor: '#fafafa',
        plot_bgcolor: '#fafafa'
    };

    const config = { responsive: true };

    Plotly.newPlot('main_chart', [{ x: [], y: [], type: 'scatter' }], layout, config);
}

async function updateMainGraph(attribute, label) {
    const reachId = document.getElementById('reach-selector').value;
    if (!reachId) {
        alert("Please select a location first.");
        return;
    }

    const selector = document.getElementById('reach-selector');
    const selectedOption = selector.options[selector.selectedIndex];

    let isDamAffected = false;
    const reachesResponse = await fetch('/static/River_reaches.geojson');
    const reachesData = await reachesResponse.json();
    const currentFeature = reachesData.features.find(f => f.properties.reach_id == reachId);

    if (currentFeature && currentFeature.properties.flow_regim === 'Dam_affected') {
        const layoutMsg = {
            title: {
                text: "There is no reliable data for this specific reach",
                font: { family: "'Segoe UI', Tahoma, sans-serif", size: 20, color: '#d9534f' }
            },
            xaxis: { visible: false },
            yaxis: { visible: false },
            annotations: [{
                text: "SWOT data quality is compromised due to dam proximity",
                xref: "paper", yref: "paper",
                showarrow: false,
                font: { size: 16 }
            }]
        };
        Plotly.newPlot('main_chart', [], layoutMsg);
        return;
    }

    const response = await fetch(`/api/swot_attribute/${reachId}/${attribute}`);
    if (!response.ok) {
        console.error("Data retrieval failed");
        return;
    }

    const data = await response.json();

    const colorMap = {
        'wse': '#002b5c',
        'width': '#ec7411ff',
        'slope': '#f34a2dff',
    };

    const selectedColor = colorMap[attribute] || '#002b5c';

    const trace = {
        x: data.dates,
        y: data.values,
        type: 'scatter',
        mode: 'lines+markers',
        name: label,
        line: { color: selectedColor, width: 2.5 },
        marker: { size: 7, color: selectedColor }
    };

    const layout = {
        title: {
            text: `${label} - Reach ID: ${reachId}`,
            font: {
                family: "'Segoe UI', Tahoma, sans-serif",
                size: 16,
                weight: 'bold'
            },
            x: 0.5,
            xanchor: 'center'
        },
        xaxis: {
            title: {
                text: 'Date',
                font: { family: "'Segoe UI', Tahoma, sans-serif", size: 14, weight: 'bold' }
            },
            automargin: true,
            type: 'date',
            tickformat: '%b %Y',
            tickfont: { family: "'Segoe UI', Tahoma, sans-serif", size: 13 },
            dtick: "M2"
        },
        yaxis: {
            title: {
                text: label,
                standoff: 7,
                font: { family: "'Segoe UI', Tahoma, sans-serif", size: 14, weight: 'bold' }
            },
            tickfont: { family: "'Segoe UI', Tahoma, sans-serif", size: 13 },
            automargin: true
        },
        autosize: true,
        margin: { t: 40, b: 40, l: 50, r: 20 },
        paper_bgcolor: '#fafafa',
        plot_bgcolor: '#fafafa'
    };

    Plotly.newPlot('main_chart', [trace], layout, { responsive: true });
}

async function addLocalLayers() {
    const selector = document.getElementById('reach-selector');

    const reachesResponse = await fetch('/static/River_reaches.geojson');
    const reachesData = await reachesResponse.json();

    reachesData.features.sort((a, b) => {
        return b.properties.reach_id - a.properties.reach_id;
    });

    const riverLayer = L.geoJSON(reachesData, {
        style: function (feature) {
            return {
                color: getFlowColor(feature.properties.flow_regim),
                weight: 5,
                opacity: 0.8
            };
        },
        onEachFeature: function (feature, layer) {
            const reachId = feature.properties.reach_id;

            const option = document.createElement('option');
            option.value = reachId;
            option.text = `Reach ${reachId}`;
            selector.appendChild(option);

            layer.on('click', function () {
                selector.value = reachId;
                const lengthInt = Math.round(feature.properties.p_length);
                layer.bindPopup(
                    `<strong>Reach ID:</strong> ${reachId}
                    <br><br><strong>Length:</strong> ${lengthInt} m`
                ).openPopup();
                resetMenuButtons();
                initializeEmptyChart();
            });
        }
    }).addTo(window.map);

    const damsResponse = await fetch('/static/dams.geojson');
    const damsData = await damsResponse.json();

    const damsLayer = L.geoJSON(damsData, {
        pointToLayer: (feature, latlng) => L.marker(latlng, { icon: damIcon }),
        onEachFeature: (feature, layer) => {
            if (feature.properties && feature.properties.Dam_Name) {
                layer.bindPopup(`
                    <div style="text-align: center;">
                        <strong>Dam Name:</strong> ${feature.properties.Dam_Name}
                    </div>
                `);
            }
        }
    }).addTo(window.map);

    const legend = L.control({ position: 'bottomright' });

    legend.onAdd = function (map) {
        const div = L.DomUtil.create('div', 'info legend');
        const regimes = ['Dam_affected', 'Dam_regulated', 'Natural', 'Natural_falls'];

        div.innerHTML = '<strong>Flow Regime</strong>';
        for (let i = 0; i < regimes.length; i++) {
            div.innerHTML +=
                '<i style="background:' + getFlowColor(regimes[i]) + '"></i> ' +
                regimes[i].replace('_', ' ') + '<br>';
        }
        return div;
    };

    legend.addTo(window.map);

    const overlayMaps = {
        "River Reaches": riverLayer,
        "Dams": damsLayer
    };
    L.control.layers(null, overlayMaps, { position: 'topright' }).addTo(window.map);

    selector.addEventListener('change', function () {
        const selectedId = this.value;
        resetMenuButtons();
        initializeEmptyChart();
        riverLayer.eachLayer(function (layer) {
            if (layer.feature.properties.reach_id === selectedId) {
                window.map.fitBounds(layer.getBounds());
                layer.openPopup();
            }
        });
    });
}

const ControlNodeCoords = [0.83535407, 33.0241901];

function addControlNodePoint() {
    const ControlNodeMarker = L.circleMarker(ControlNodeCoords, {
        radius: 10,
        fillColor: "#28a745",
        color: "#ffffff",
        weight: 2,
        opacity: 1,
        fillOpacity: 1,
        pane: 'top-layer-pane'
    })
        .bindPopup("<b>Control Node: Mbulamuti</b><br>SWOT Estimated Discharge Data")
        .addTo(window.map);

    return ControlNodeMarker;
}

async function updateValidationGraph(attribute, label) {
    const response = await fetch(`/api/validation_data/${attribute}`);
    if (!response.ok) {
        console.error("Validation data retrieval failed");
        return;
    }

    const data = await response.json();
    const trace = {
        x: data.dates,
        y: data.values,
        type: 'scatter',
        mode: 'markers+lines',
        name: label,
        line: { color: '#257233ff', width: 2.5 },
        marker: { size: 7, color: '#257233ff' }
    };

    const layout = {
        title: {
            text: `<b>${label} (Control Node)</b>`,
            font: { family: "'Segoe UI', Tahoma, sans-serif", size: 16, weight: 'bold' },
            x: 0.5,
            xanchor: 'center'
        },
        xaxis: {
            title: { text: 'Date', font: { family: "'Segoe UI', Tahoma, sans-serif", size: 14, weight: 'bold' } }, automargin: true,
            type: 'date',
            tickformat: '%b %Y',
            tickfont: { family: "'Segoe UI', Tahoma, sans-serif", size: 13 },
            dtick: "M2"
        },
        yaxis: {
            title: {
                text: label, standoff: 7,
                font: { family: "'Segoe UI', Tahoma, sans-serif", size: 14, weight: 'bold' }
            },
            tickfont: { family: "'Segoe UI', Tahoma, sans-serif", size: 13 },
            automargin: true
        },
        autosize: true,
        margin: { t: 40, b: 40, l: 50, r: 20 },
        paper_bgcolor: '#fafafa',
        plot_bgcolor: '#fafafa'
    };

    Plotly.newPlot('main_chart', [trace], layout, { responsive: true });
}


document.addEventListener('DOMContentLoaded', () => {
    if (window.map) {
        addLocalLayers();
        addControlNodePoint();
        initializeEmptyChart();

        const buttons = {
            'btn-slope': ['slope', 'Mean Slope [m/m]'],
            'btn-width': ['width', 'River Width [m]'],
            'btn-wse': ['wse', 'Water Surface Elevation [m]'],
            'btn-q': ['Q_calc', 'Discharge (Manning) [m³/s]']
        };

        const buttonIds = Object.keys(buttons);

        buttonIds.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.onclick = () => {
                    buttonIds.forEach(otherId => {
                        const otherBtn = document.getElementById(otherId);
                        if (otherBtn) otherBtn.classList.remove('active');
                    });
                    btn.classList.add('active');
                    if (id === 'btn-q') {
                        window.map.flyTo(ControlNodeCoords, 13, {
                            animate: true,
                            duration: 1.5
                        });
                        updateValidationGraph('Q_calc', 'Discharge [m³/s]');
                    } else {
                        updateMainGraph(buttons[id][0], buttons[id][1]);
                    }
                };
            } else {
                console.warn(`Button with ID ${id} not found.`);
            }
        });
    }
});

function resetMenuButtons() {
    const buttonIds = ['btn-slope', 'btn-width', 'btn-wse', 'btn-q'];
    buttonIds.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) btn.classList.remove('active');
    });
}