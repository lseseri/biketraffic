// Set your Mapbox access token here
mapboxgl.accessToken = 'pk.eyJ1IjoibHNlc2VyaSIsImEiOiJjbTdiMWJlMWQwMTVuMmtvbnZwZGYyYmliIn0.A7V6OB5lL3CoX4_VCp3Bjw';

// Initialize the map
const map = new mapboxgl.Map({
    container: 'map', // ID of the div where the map will render
    style: 'mapbox://styles/mapbox/streets-v12', // Map style
    center: [-71.09415, 42.36027], // [longitude, latitude]
    zoom: 12, // Initial zoom level
    minZoom: 5, // Minimum allowed zoom
    maxZoom: 18 // Maximum allowed zoom
});

let stations = [];
let trips = [];
let filteredTrips = [];
let filteredArrivals = new Map();
let filteredDepartures = new Map();
let filteredStations = [];

map.on('load', () => { 
    // add bike routes for boston
    map.addSource('boston_route', {
        type: 'geojson',
        data: 'https://bostonopendata-boston.opendata.arcgis.com/datasets/boston::existing-bike-network-2022.geojson?...'
    });

    map.addLayer({
        id: 'bike-lanes',
        type: 'line',
        source: 'boston_route',
        paint: {
          'line-color': '#32D400',
          'line-width': 3,
          'line-opacity': 0.5
        }
    });

    // add bike routes for cambridge
    map.addSource('cambridge_route', {
        type: 'geojson',
        data: 'https://raw.githubusercontent.com/cambridgegis/cambridgegis_data/main/Recreation/Bike_Facilities/RECREATION_BikeFacilities.geojson'
    });

    map.addLayer({
        id: 'bike-lanes-cambridge',
        type: 'line',
        source: 'cambridge_route',
        paint: {
          'line-color': '#32D400',
          'line-width': 3,
          'line-opacity': 0.5
        }
    });

    // Load the nested JSON file
    const jsonurl = "https://dsc106.com/labs/lab07/data/bluebikes-stations.json";
    d3.json(jsonurl).then(jsonData => {
        stations = jsonData.data.stations;

        const csvurl = "https://dsc106.com/labs/lab07/data/bluebikes-traffic-2024-03.csv";
        d3.csv(csvurl).then(trips => {
            departures = d3.rollup(
                trips,
                (v) => v.length,
                (d) => d.start_station_id,
            );
            arrivals = d3.rollup(
                trips,
                (v) => v.length,
                (d) => d.end_station_id,
            );

            stations = stations.map((station) => {
                let id = station.short_name;
                station.arrivals = arrivals.get(id) ?? 0;
                station.departures = departures.get(id) ?? 0;
                station.totalTraffic = station.arrivals + station.departures;
                return station;
            });

            const radiusScale = d3
                .scaleSqrt()
                .domain([0, d3.max(stations, (d) => d.totalTraffic)])
                .range([0, 25]);

            const svg = d3.select('#map').select('svg');
            // Append circles to the SVG for each station
            const circles = svg.selectAll('circle')
                .data(stations)
                .enter()
                .append('circle')
                .attr('r', d => radiusScale(d.totalTraffic))  // Radius of the circle
                .attr('stroke-width', 1)    // Circle border thickness
                .attr('opacity', 0.8)      // Circle opacity
                .each(function(d) {
                    d3.select(this)
                        .append('title')
                        .text(`${d.totalTraffic} trips (${d.departures} departures, ${d.arrivals} arrivals)`);
                });

            // Function to update circle positions when the map moves/zooms
            function updatePositions() {
                circles
                    .attr('cx', d => getCoords(d).cx)  // Set the x-position using projected coordinates
                    .attr('cy', d => getCoords(d).cy); // Set the y-position using projected coordinates
            }

            // Initial position update when map loads
            updatePositions();
            
            // Reposition markers on map interactions
            map.on('move', updatePositions);     // Update during map movement
            map.on('zoom', updatePositions);     // Update during zooming
            map.on('resize', updatePositions);   // Update on window resize
            map.on('moveend', updatePositions);  // Final adjustment after movement ends

        }) .catch(error => {
            console.error('Error loading CSV:', error); 
        });

    }).catch(error => {
        console.error('Error loading JSON:', error);  // Handle errors if JSON loading fails
    });
});

function getCoords(station) {
    const point = new mapboxgl.LngLat(+station.lon, +station.lat);  // Convert lon/lat to Mapbox LngLat
    const { x, y } = map.project(point);  // Project to pixel coordinates
    return { cx: x, cy: y };  // Return as object for use in SVG attributes
}

let timeFilter = -1;

const timeSlider = document.getElementById('time-slider');
const selectedTime = document.getElementById('selected-time');
const anyTimeLabel = document.getElementById('any-time');

function formatTime(minutes) {
    const date = new Date(0, 0, 0, 0, minutes);  // Set hours & minutes
    return date.toLocaleString('en-US', { timeStyle: 'short' }); // Format as HH:MM AM/PM
}

function updateTimeDisplay() {
    timeFilter = Number(timeSlider.value);  // Get slider value
  
    if (timeFilter === -1) {
        selectedTime.textContent = '';  // Clear time display
        anyTimeLabel.style.display = 'block';  // Show "(any time)"
    } else {
        selectedTime.textContent = formatTime(timeFilter);  // Display formatted time
        anyTimeLabel.style.display = 'none';  // Hide "(any time)"
    }
    // filterTripsByTime();
}

timeSlider.addEventListener('input', updateTimeDisplay);
updateTimeDisplay();