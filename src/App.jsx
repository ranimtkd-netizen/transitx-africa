import { useEffect, useMemo, useState } from 'react';
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  Popup,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './App.css';

const distancesFromTangier = {
  Mauritania: 2500,
  Senegal: 3400,
  Mali: 3600,
  'Côte d’Ivoire': 4700,
  Ghana: 5200,
  Nigeria: 5600,
  Guinea: 4100,
  'Burkina Faso': 4300,
  Niger: 4500,
};

const cityAdjust = {
  Tangier: 0,
  Casablanca: -300,
  Rabat: -250,
  Marrakech: -450,
  Agadir: -650,
  Fez: -100,
};

const fuelPrices = {
  Morocco: 14,
  Mauritania: 13,
  Senegal: 15,
  Mali: 14.5,
  'Côte d’Ivoire': 15.5,
  Ghana: 14.8,
  Nigeria: 12,
  Guinea: 15,
  'Burkina Faso': 14.7,
  Niger: 13.8,
};
const realRouteStops = [
  {
    name: 'Tangier, Morocco',
    type: 'Origin',
    position: [35.7595, -5.834],
    note: 'Starting point and shipment preparation.',
  },
  {
    name: 'Agadir, Morocco',
    type: 'Fuel / Rest',
    position: [30.4278, -9.5981],
    note: 'Useful fuel and driver rest stop before the south route.',
  },
  {
    name: 'Laâyoune, Morocco',
    type: 'Rest Stop',
    position: [27.1536, -13.2033],
    note: 'Recommended secure stop for rest and vehicle check.',
  },
  {
    name: 'Dakhla, Morocco',
    type: 'Fuel / Overnight',
    position: [23.6848, -15.957],
    note: 'Important stop before entering Mauritania.',
  },
  {
    name: 'Nouadhibou, Mauritania',
    type: 'Border / Fuel',
    position: [20.9425, -17.0362],
    note: 'Border area and fuel planning point.',
  },
  {
    name: 'Nouakchott, Mauritania',
    type: 'Fuel / Rest',
    position: [18.0735, -15.9582],
    note: 'Major city for refueling and secure overnight parking.',
  },
  {
    name: 'Rosso, Senegal border',
    type: 'Border Crossing',
    position: [16.5138, -15.805],
    note: 'Border crossing point toward Senegal.',
  },
  {
    name: 'Saint-Louis, Senegal',
    type: 'Rest Stop',
    position: [16.0326, -16.4818],
    note: 'Recommended stop before the final road to Dakar.',
  },
  {
    name: 'Dakar, Senegal',
    type: 'Destination',
    position: [14.7167, -17.4677],
    note: 'Final delivery destination.',
  },
];

const routeCoordinates = realRouteStops.map((stop) => stop.position);

const truckIcon = new L.DivIcon({
  html: '🚚',
  className: 'truckIcon',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

const stopIcon = new L.DivIcon({
  html: '📍',
  className: 'stopIcon',
  iconSize: [28, 28],
  iconAnchor: [14, 28],
});
const routes = {
  Mauritania: 'Morocco → Mauritania',
  Senegal: 'Morocco → Mauritania → Senegal',
  Mali: 'Morocco → Mauritania → Mali',
  'Côte d’Ivoire': 'Morocco → Mauritania → Mali → Côte d’Ivoire',
  Ghana: 'Morocco → Mauritania → Mali → Burkina Faso → Ghana',
  Nigeria: 'Morocco → Mauritania → Mali → Niger → Nigeria',
  Guinea: 'Morocco → Mauritania → Senegal → Guinea',
  'Burkina Faso': 'Morocco → Mauritania → Mali → Burkina Faso',
  Niger: 'Morocco → Mauritania → Mali → Niger',
};

const initialForm = {
  goodsType: 'Bottled water',
  description: 'Bottled water shipment',
  quantity: 10,
  weight: 10,
  weightUnit: 'tons',
  length: 120,
  width: 80,
  height: 160,
  dimensionUnit: 'cm',
  packagingUnit: 'pallets',
  fragility: 'low',
  perishable: 'no',
  refrigeration: 'no',
  hazardous: 'no',
  liquid: 'no',
  originCity: 'Tangier',
  destinationCountry: 'Senegal',
  destinationCity: 'Dakar',
  speed: 'Standard',
  fuelPrice: 14,
  consumption: 32,
  driverWage: 500,
  borderFees: 3500,
  packagingCost: 120,
  currency: 'MAD',
  avgSpeed: 70,
  maxHours: 8,
  restHours: 2,
  tankCapacity: 600,
};

function App() {
  const [form, setForm] = useState(initialForm);
  const [generated, setGenerated] = useState(false);
  const [tracking, setTracking] = useState(0);
  const [timer, setTimer] = useState(null);
  const [liveRates, setLiveRates] = useState({
    MAD: 1,
    EUR: null,
    USD: null,
    XOF: null,
  });

  const [rateStatus, setRateStatus] = useState(
    'Loading live exchange rates...'
  );
  useEffect(() => {
    async function loadExchangeRates() {
      try {
        const response = await fetch('https://open.er-api.com/v6/latest/MAD');
        const data = await response.json();

        if (data && data.result === 'success' && data.rates) {
          setLiveRates({
            MAD: 1,
            EUR: data.rates.EUR,
            USD: data.rates.USD,
            XOF: data.rates.XOF,
          });
          setRateStatus('Live exchange rates loaded successfully.');
        } else {
          setRateStatus(
            'Live rates unavailable. Fallback rates are being used.'
          );
        }
      } catch (error) {
        setRateStatus('Live rates unavailable. Fallback rates are being used.');
      }
    }

    loadExchangeRates();
  }, []);
  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const distance = useMemo(() => {
    const base = distancesFromTangier[form.destinationCountry] || 3500;
    const adjust = cityAdjust[form.originCity] || 0;
    return Math.max(base + adjust, 1000);
  }, [form.destinationCountry, form.originCity]);

  const weightTons =
    form.weightUnit === 'kg' ? Number(form.weight) / 1000 : Number(form.weight);

  const volumeM3 = useMemo(() => {
    let l = Number(form.length);
    let w = Number(form.width);
    let h = Number(form.height);
    if (form.dimensionUnit === 'cm') {
      l = l / 100;
      w = w / 100;
      h = h / 100;
    }
    return Math.max(l * w * h * Number(form.quantity), 0.01);
  }, [form]);

  const packageCount = Math.max(
    1,
    Math.ceil((weightTons * 1000) / 500 + volumeM3 / 2)
  );

  const packaging = recommendPackaging(form);
  const vehicle = recommendVehicle(weightTons, form);
  const route =
    routes[form.destinationCountry] || 'Morocco → African destination';

  const fuelNeeded = (distance * Number(form.consumption)) / 100;
  const fuelCost = fuelNeeded * Number(form.fuelPrice);
  const refuelStops = Math.ceil(fuelNeeded / Number(form.tankCapacity));

  const drivingTime = distance / Number(form.avgSpeed);
  const restStops = Math.floor(drivingTime / Number(form.maxHours));
  const totalRest = restStops * Number(form.restHours);
  const totalTravel = drivingTime + totalRest;
  const travelDays = Math.ceil(totalTravel / 24);

  const driverCost = travelDays * Number(form.driverWage);
  const packagingTotal = packageCount * Number(form.packagingCost);
  const operatingCost = distance * 2;
  const multiplier =
    form.speed === 'Urgent' ? 1.25 : form.speed === 'Standard' ? 1.1 : 1;

  const totalBefore =
    fuelCost +
    driverCost +
    Number(form.borderFees) +
    packagingTotal +
    operatingCost;

  const totalCost = totalBefore * multiplier;

  const conversion = {
    MAD: totalCost,
    EUR: liveRates.EUR ? totalCost * liveRates.EUR : totalCost / 10.8,
    USD: liveRates.USD ? totalCost * liveRates.USD : totalCost / 10,
    XOF: liveRates.XOF ? totalCost * liveRates.XOF : totalCost * 60,
  };

  const risk = getRisk(form, distance);
  const safetyNotes = getSafetyNotes(form, distance);

  const countries = route.split('→').map((c) => c.trim());
  const routeFuelPrices = countries
    .filter((c) => fuelPrices[c])
    .map((c) => ({ country: c, price: fuelPrices[c] }));
  const cheapest = routeFuelPrices.sort((a, b) => a.price - b.price)[0];

  function startTracking() {
    if (timer) return;
    const id = setInterval(() => {
      setTracking((p) => {
        if (p >= 100) {
          clearInterval(id);
          setTimer(null);
          return 100;
        }
        return p + 5;
      });
    }, 500);
    setTimer(id);
  }

  function pauseTracking() {
    clearInterval(timer);
    setTimer(null);
  }

  function resetTracking() {
    clearInterval(timer);
    setTimer(null);
    setTracking(0);
  }

  function loadCaseStudy() {
    setForm(initialForm);
    setGenerated(true);
    setTimeout(() => {
      document
        .getElementById('dashboard')
        ?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  }

  function generatePlan() {
    setGenerated(true);
    setTimeout(() => {
      document
        .getElementById('dashboard')
        ?.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  }

  return (
    <div className="app">
      <nav className="navbar">
        <div className="brand">
          <img
            className="brandLogo"
            src="/logo.png"
            alt="TransitX Africa logo"
          />
          <div>
            <h2>TransitX Africa</h2>
            <span>Connecting Africa • Moving Futures</span>
          </div>
        </div>
        <div className="navlinks">
          <a href="#home">Home</a>
          <a href="#planner">Planner</a>
          <a href="#case">Case Study</a>
          <a href="#future">Future</a>
        </div>
      </nav>

      <header id="home" className="hero newHero">
        <div className="heroText">
          <p className="badge">Challenge CIEL Project 2025–2026</p>

          <h1>
            Smarter Road Freight
            <span> from Morocco to Africa</span>
          </h1>

          <p className="heroSub">
            TransitX Africa helps transport companies plan shipments, choose the
            right packaging and vehicle, estimate fuel and costs, and follow the
            truck journey with smart route recommendations.
          </p>

          <div className="heroActions">
            <a href="#planner" className="btn primary">
              Start Planning
            </a>
            <a href="#case" className="btn secondary">
              View Case Study
            </a>
          </div>

          <div className="heroStats">
            <div>
              <b>10+</b>
              <span>African routes</span>
            </div>
            <div>
              <b>AI</b>
              <span>Logistics assistant</span>
            </div>
            <div>
              <b>GPS</b>
              <span>Tracking simulation</span>
            </div>
          </div>
        </div>

        <div className="heroGlass">
          <img
            src="/logo.png"
            alt="TransitX Africa logo"
            className="heroLogo"
          />

          <div className="routeCard">
            <div className="routeTop">
              <span>Tangier</span>
              <span>Dakar</span>
            </div>

            <div className="routeLine">
              <span className="point start"></span>
              <span className="movingTruck">🚚</span>
              <span className="point end"></span>
            </div>

            <div className="routeInfo">
              <div>
                <b>3,400 km</b>
                <span>Estimated route</span>
              </div>
              <div>
                <b>1,088 L</b>
                <span>Fuel needed</span>
              </div>
            </div>
          </div>

          <div className="floatingTag tagOne">Packaging AI</div>
          <div className="floatingTag tagTwo">Fuel + Cost</div>
          <div className="floatingTag tagThree">Driver Stops</div>
        </div>
      </header>

      <section className="features">
        {[
          'AI Shipment Analysis',
          'Packaging Recommendation',
          'Vehicle Selection',
          'Route Optimization',
          'GPS Tracking',
          'Fuel & Cost Management',
          'Driver Rest Planning',
          'Currency Conversion',
        ].map((f) => (
          <div className="featureCard" key={f}>
            {f}
          </div>
        ))}
      </section>

      <section className="section gridTwo">
        <div>
          <p className="badge">Problem</p>
          <h2>Road freight between Morocco and Africa is complex.</h2>
          <p>
            Companies face poor route planning, high fuel consumption, fuel
            price fluctuation, delivery delays, driver fatigue, vehicle
            selection issues, packaging risks, lack of tracking, and currency
            conversion complexity.
          </p>
        </div>
        <div className="problemGrid">
          {[
            'Route delays',
            'Fuel costs',
            'Driver fatigue',
            'Packaging mistakes',
            'No tracking',
            'Currency issues',
          ].map((x) => (
            <div className="smallCard" key={x}>
              ⚠️ {x}
            </div>
          ))}
        </div>
      </section>

      <section className="section solution">
        <p className="badge">Solution</p>
        <h2>
          TransitX Africa centralizes the transport plan in one smart dashboard.
        </h2>
        <p>
          The platform generates packaging, container, vehicle, route, fuel
          planning, driver rest schedule, GPS tracking simulation, total cost,
          currency conversion, and a printable logistics report.
        </p>
      </section>

      <section id="planner" className="section planner">
        <p className="badge">Smart Planner</p>
        <h2>Enter your shipment information</h2>

        <div className="formGrid">
          <Select
            label="Goods type"
            value={form.goodsType}
            onChange={(v) => update('goodsType', v)}
            options={[
              'Bottled water',
              'Food products',
              'Textile',
              'Electronics',
              'Cosmetics',
              'Medicine',
              'Automotive parts',
              'Furniture',
              'Agricultural products',
              'Construction materials',
              'Liquids',
              'Other',
            ]}
          />
          <Input
            label="Goods description"
            value={form.description}
            onChange={(v) => update('description', v)}
          />
          <Input
            label="Quantity"
            type="number"
            value={form.quantity}
            onChange={(v) => update('quantity', v)}
          />
          <Input
            label="Weight"
            type="number"
            value={form.weight}
            onChange={(v) => update('weight', v)}
          />
          <Select
            label="Weight unit"
            value={form.weightUnit}
            onChange={(v) => update('weightUnit', v)}
            options={['kg', 'tons']}
          />
          <Input
            label="Length"
            type="number"
            value={form.length}
            onChange={(v) => update('length', v)}
          />
          <Input
            label="Width"
            type="number"
            value={form.width}
            onChange={(v) => update('width', v)}
          />
          <Input
            label="Height"
            type="number"
            value={form.height}
            onChange={(v) => update('height', v)}
          />
          <Select
            label="Dimension unit"
            value={form.dimensionUnit}
            onChange={(v) => update('dimensionUnit', v)}
            options={['cm', 'm']}
          />
          <Select
            label="Packaging unit"
            value={form.packagingUnit}
            onChange={(v) => update('packagingUnit', v)}
            options={[
              'cartons',
              'pallets',
              'boxes',
              'bags',
              'crates',
              'barrels',
            ]}
          />
          <Select
            label="Fragility"
            value={form.fragility}
            onChange={(v) => update('fragility', v)}
            options={['low', 'medium', 'high']}
          />
          <Select
            label="Perishable"
            value={form.perishable}
            onChange={(v) => update('perishable', v)}
            options={['no', 'yes']}
          />
          <Select
            label="Refrigeration"
            value={form.refrigeration}
            onChange={(v) => update('refrigeration', v)}
            options={['no', 'refrigerated', 'frozen']}
          />
          <Select
            label="Hazardous goods"
            value={form.hazardous}
            onChange={(v) => update('hazardous', v)}
            options={['no', 'yes']}
          />
          <Select
            label="Liquid goods"
            value={form.liquid}
            onChange={(v) => update('liquid', v)}
            options={['no', 'yes']}
          />
          <Select
            label="Origin city"
            value={form.originCity}
            onChange={(v) => update('originCity', v)}
            options={[
              'Tangier',
              'Casablanca',
              'Rabat',
              'Marrakech',
              'Agadir',
              'Fez',
            ]}
          />
          <Select
            label="Destination country"
            value={form.destinationCountry}
            onChange={(v) => update('destinationCountry', v)}
            options={Object.keys(distancesFromTangier)}
          />
          <Input
            label="Destination city"
            value={form.destinationCity}
            onChange={(v) => update('destinationCity', v)}
          />
          <Select
            label="Delivery speed"
            value={form.speed}
            onChange={(v) => update('speed', v)}
            options={['Economy', 'Standard', 'Urgent']}
          />
          <Input
            label="Fuel price MAD/L"
            type="number"
            value={form.fuelPrice}
            onChange={(v) => update('fuelPrice', v)}
          />
          <Input
            label="Consumption L/100km"
            type="number"
            value={form.consumption}
            onChange={(v) => update('consumption', v)}
          />
          <Input
            label="Driver daily wage MAD"
            type="number"
            value={form.driverWage}
            onChange={(v) => update('driverWage', v)}
          />
          <Input
            label="Border / toll / customs fees"
            type="number"
            value={form.borderFees}
            onChange={(v) => update('borderFees', v)}
          />
          <Input
            label="Packaging unit cost"
            type="number"
            value={form.packagingCost}
            onChange={(v) => update('packagingCost', v)}
          />
          <Select
            label="Currency"
            value={form.currency}
            onChange={(v) => update('currency', v)}
            options={['MAD', 'EUR', 'USD', 'XOF']}
          />
          <Input
            label="Average speed km/h"
            type="number"
            value={form.avgSpeed}
            onChange={(v) => update('avgSpeed', v)}
          />
          <Input
            label="Max driving hours before rest"
            type="number"
            value={form.maxHours}
            onChange={(v) => update('maxHours', v)}
          />
          <Input
            label="Rest duration hours"
            type="number"
            value={form.restHours}
            onChange={(v) => update('restHours', v)}
          />
          <Input
            label="Fuel tank capacity L"
            type="number"
            value={form.tankCapacity}
            onChange={(v) => update('tankCapacity', v)}
          />
        </div>

        <button className="btn primary big" onClick={generatePlan}>
          Generate Transport Plan
        </button>
      </section>

      {generated && (
        <section id="dashboard" className="section dashboard">
          <p className="badge success">AI Shipment Analysis Completed</p>
          <h2>Transport Plan Dashboard</h2>

          <div className="summaryGrid">
            <ResultCard
              title="Distance"
              value={`${distance.toLocaleString()} km`}
            />
            <ResultCard
              title="Total Weight"
              value={`${weightTons.toFixed(2)} tons`}
            />
            <ResultCard
              title="Fuel Needed"
              value={`${fuelNeeded.toFixed(0)} L`}
            />
            <ResultCard
              title="Final Cost"
              value={`${conversion[form.currency].toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })} ${form.currency}`}
            />
            <ResultCard
              title="Travel Time"
              value={`${totalTravel.toFixed(1)} h`}
            />
            <ResultCard title="Risk Level" value={risk} />
          </div>

          <div className="dashGrid">
            <Panel title="Packaging Recommendation">
              <h3>{packaging.name}</h3>
              <p>
                <b>Container:</b> {packaging.container}
              </p>
              <p>
                <b>Estimated packages:</b> {packageCount}
              </p>
              <p>{packaging.reason}</p>
              <p className="note">{packaging.advice}</p>
            </Panel>

            <Panel title="Vehicle Recommendation">
              <h3>{vehicle.name}</h3>
              <p>
                <b>Capacity:</b> {vehicle.capacity}
              </p>
              <p>{vehicle.reason}</p>
              <p className="note">{vehicle.safety}</p>
            </Panel>

            <Panel title="Route Optimization">
              <h3>
                {form.originCity}, Morocco → {form.destinationCity},{' '}
                {form.destinationCountry}
              </h3>
              <p>
                <b>Route:</b> {route}
              </p>
              <p>
                <b>Distance:</b> {distance} km
              </p>
              <p>
                <b>Reliability score:</b> 87%
              </p>
              <p>
                <b>Border crossing:</b> Morocco / Mauritania and route borders
              </p>
            </Panel>

            <Panel title="Real Route Map & GPS Tracking">
              <div className="realMapBox">
                <MapContainer
                  center={[25.5, -12.5]}
                  zoom={5}
                  scrollWheelZoom={false}
                  className="realMap"
                >
                  <TileLayer
                    attribution="&copy; OpenStreetMap contributors"
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />

                  <Polyline
                    positions={routeCoordinates}
                    pathOptions={{ color: '#ff7a00', weight: 5 }}
                  />

                  {realRouteStops.map((stop) => (
                    <Marker
                      key={stop.name}
                      position={stop.position}
                      icon={stopIcon}
                    >
                      <Popup>
                        <b>{stop.name}</b>
                        <br />
                        {stop.type}
                        <br />
                        {stop.note}
                      </Popup>
                    </Marker>
                  ))}

                  <Marker
                    position={
                      routeCoordinates[
                        Math.min(
                          Math.floor(
                            (tracking / 100) * (routeCoordinates.length - 1)
                          ),
                          routeCoordinates.length - 1
                        )
                      ]
                    }
                    icon={truckIcon}
                  >
                    <Popup>Truck position: {tracking}% completed</Popup>
                  </Marker>
                </MapContainer>
              </div>

              <div className="progress">
                <div style={{ width: `${tracking}%` }}></div>
              </div>

              <p>
                <b>Route:</b> Tangier → Agadir → Laâyoune → Dakhla → Nouadhibou
                → Nouakchott → Rosso → Saint-Louis → Dakar
              </p>
              <p>
                <b>Progress:</b> {tracking}%
              </p>
              <p>
                <b>Remaining distance:</b>{' '}
                {Math.max(distance * (1 - tracking / 100), 0).toFixed(0)} km
              </p>
              <p>
                <b>Status:</b>{' '}
                {tracking === 100
                  ? 'Delivered'
                  : tracking > 75
                  ? 'Near destination'
                  : tracking > 45
                  ? 'Refueling / Rest stop'
                  : tracking > 0
                  ? 'On route'
                  : 'Preparing'}
              </p>

              <div className="aiStops">
                <h4>AI Suggested Real Stops</h4>
                <ul>
                  <li>
                    <b>Agadir:</b> fuel + technical check before the south
                    route.
                  </li>
                  <li>
                    <b>Laâyoune:</b> safe rest stop and driver break.
                  </li>
                  <li>
                    <b>Dakhla:</b> overnight parking and refuel before
                    Mauritania.
                  </li>
                  <li>
                    <b>Nouadhibou:</b> border area and refueling point.
                  </li>
                  <li>
                    <b>Nouakchott:</b> main fuel and rest city in Mauritania.
                  </li>
                  <li>
                    <b>Saint-Louis:</b> final rest stop before Dakar.
                  </li>
                </ul>
              </div>

              <div className="buttons">
                <button onClick={startTracking}>Start Tracking</button>
                <button onClick={pauseTracking}>Pause</button>
                <button onClick={resetTracking}>Reset</button>
              </div>
            </Panel>

            <Panel title="Driver Rest Management">
              <p>
                <b>Driving time:</b> {drivingTime.toFixed(1)} h
              </p>
              <p>
                <b>Rest stops:</b> {restStops}
              </p>
              <p>
                <b>Total rest time:</b> {totalRest} h
              </p>
              <p>
                <b>Total travel duration:</b> {totalTravel.toFixed(1)} h
              </p>
              <ul>
                <li>Secure Parking Zone</li>
                <li>Service Station</li>
                <li>Café / Restaurant Stop</li>
                <li>Overnight Parking Area</li>
              </ul>
            </Panel>

            <Panel title="Fuel Management">
              <p>
                <b>Fuel needed:</b> {fuelNeeded.toFixed(0)} L
              </p>
              <p>
                <b>Fuel cost:</b>{' '}
                {fuelCost.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}{' '}
                MAD
              </p>
              <p>
                <b>Refueling stops:</b> {refuelStops}
              </p>
              <p className="note">
                Refuel before entering high-price areas when possible.
              </p>
              {cheapest && (
                <p>
                  <b>Cheapest route fuel:</b> {cheapest.country} —{' '}
                  {cheapest.price} MAD/L
                </p>
              )}
            </Panel>

            <Panel title="Cost Estimation">
              <p>Fuel: {fuelCost.toFixed(0)} MAD</p>
              <p>Driver: {driverCost.toFixed(0)} MAD</p>
              <p>
                Border/Toll/Customs: {Number(form.borderFees).toFixed(0)} MAD
              </p>
              <p>Packaging: {packagingTotal.toFixed(0)} MAD</p>
              <p>Operating cost: {operatingCost.toFixed(0)} MAD</p>
              <h3>
                Total:{' '}
                {totalCost.toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}{' '}
                MAD
              </h3>
              <p>
                <b>Cost/km:</b> {(totalCost / distance).toFixed(2)} MAD
              </p>
              <p>
                <b>Cost/ton:</b> {(totalCost / weightTons).toFixed(0)} MAD
              </p>
            </Panel>

            <Panel title="Currency Conversion">
              <div className="currencyGrid">
                {Object.entries(conversion).map(([cur, val]) => (
                  <div
                    className={
                      cur === form.currency ? 'currency active' : 'currency'
                    }
                    key={cur}
                  >
                    <b>{cur}</b>
                    <span>
                      {val.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </span>
                  </div>
                ))}
              </div>
              <p className="rateStatus">{rateStatus}</p>
              <p className="note">
                Currency conversion is updated automatically when the online
                exchange API is available.
              </p>
            </Panel>

            <Panel title="Safety & Logistics Notes">
              <ul>
                {safetyNotes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
            </Panel>
          </div>

          <div className="report">
            <h2>Printable Logistics Report</h2>
            <p>
              <b>Project:</b> TransitX Africa
            </p>
            <p>
              <b>Shipment:</b> {form.goodsType} — {weightTons.toFixed(2)} tons
            </p>
            <p>
              <b>Route:</b> {form.originCity}, Morocco → {form.destinationCity},{' '}
              {form.destinationCountry}
            </p>
            <p>
              <b>Packaging:</b> {packaging.name}
            </p>
            <p>
              <b>Vehicle:</b> {vehicle.name}
            </p>
            <p>
              <b>Fuel needed:</b> {fuelNeeded.toFixed(0)} L
            </p>
            <p>
              <b>Total estimated cost:</b> {totalCost.toFixed(0)} MAD
            </p>
            <p>
              <b>Final recommendation:</b> This shipment is suitable for
              organized road transport with planned rest stops, fuel management,
              secure loading, and GPS monitoring.
            </p>
            <button className="btn primary" onClick={() => window.print()}>
              Print Report
            </button>
          </div>
        </section>
      )}

      <section id="case" className="section case">
        <p className="badge">Case Study</p>
        <h2>10 tons of bottled water from Tangier to Dakar</h2>
        <p>
          A Moroccan distribution company wants to transport bottled water from
          Tangier, Morocco to Dakar, Senegal. The platform recommends cartons,
          wooden pallets, stretch film, a 12-ton rigid truck, route through
          Mauritania, fuel planning, driver rest stops, GPS tracking, and cost
          estimation.
        </p>
        <div className="caseGrid">
          <ResultCard title="Goods" value="Bottled water" />
          <ResultCard title="Weight" value="10 tons" />
          <ResultCard title="Route" value="Tangier → Dakar" />
          <ResultCard title="Distance" value="3400 km" />
          <ResultCard title="Fuel Needed" value="1088 L" />
          <ResultCard title="Vehicle" value="12-ton rigid truck" />
        </div>
        <button className="btn primary big" onClick={loadCaseStudy}>
          Load Case Study into Planner
        </button>
      </section>

      <section className="section benefits">
        <p className="badge">Benefits</p>
        <h2>Benefits for companies, drivers, Morocco, and Africa</h2>
        <div className="benefitGrid">
          <Panel title="Companies">
            <p>
              Save time, reduce planning errors, reduce fuel costs, improve
              vehicle utilization, and improve customer satisfaction.
            </p>
          </Panel>
          <Panel title="Drivers">
            <p>
              Better route visibility, rest time planning, fuel station
              recommendations, and safer journeys.
            </p>
          </Panel>
          <Panel title="Morocco">
            <p>
              Strengthens Morocco as a logistics gateway to Africa and supports
              Moroccan exports.
            </p>
          </Panel>
          <Panel title="Africa">
            <p>
              Better trade connection, faster goods movement, and stronger
              economic cooperation.
            </p>
          </Panel>
        </div>
      </section>

      <section id="future" className="section future">
        <p className="badge">Future Features</p>
        <h2>Future development</h2>
        <div className="features">
          {[
            'Real GPS tracking',
            'Live fuel prices',
            'Real exchange API',
            'AI route optimization',
            'Traffic analysis',
            'Weather forecasting',
            'Predictive maintenance',
            'Customs document assistant',
            'Mobile app',
            'Delivery notifications',
          ].map((f) => (
            <div className="featureCard" key={f}>
              {f}
            </div>
          ))}
        </div>
      </section>

      <footer>
        <h2>TransitX Africa</h2>
        <p>Connecting Africa • Moving Futures</p>
        <p>Challenge CIEL Project 2025–2026</p>
        <p>Prepared by: Ranim Harfouch, Rinad Harfouch, Sajid Harfouch</p>
        <p>Supervised by: Mr. Mohammed Ayassine</p>
      </footer>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text' }) {
  return (
    <label>
      <span>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label>
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}

function ResultCard({ title, value }) {
  return (
    <div className="resultCard">
      <span>{title}</span>
      <h3>{value}</h3>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div className="panel">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

function recommendPackaging(f) {
  let name = 'Standard cartons + pallets';
  let container = 'Standard container';
  let reason = 'Suitable for general road freight transport.';
  let advice = 'Use stable loading, labels, and protective wrapping.';

  if (f.goodsType === 'Bottled water') {
    name = 'Cartons + wooden pallets + stretch film';
    reason = 'Easy handling, stable loading, and protection during transport.';
  } else if (f.goodsType === 'Electronics') {
    name = 'Reinforced cartons + bubble wrap + humidity protection';
    reason = 'Protects goods from shock and humidity.';
  } else if (f.goodsType === 'Food products') {
    name = 'Food-grade cartons or insulated boxes';
    reason = 'Protects hygiene and product quality.';
  } else if (f.goodsType === 'Medicine') {
    name = 'Insulated medical packaging';
    container = 'Insulated or refrigerated container';
    reason = 'Supports documentation and temperature control.';
  } else if (f.goodsType === 'Construction materials') {
    name = 'Pallets + straps + heavy load fixing';
    reason = 'Supports heavy cargo stability.';
  } else if (f.goodsType === 'Liquids' || f.liquid === 'yes') {
    name = 'Barrels or sealed containers + anti-leak protection';
    container = 'Sealed container';
    reason = 'Prevents leakage during transport.';
  }

  if (f.fragility === 'high')
    advice += ' Add shock protection and reinforced boxes.';
  if (f.refrigeration !== 'no') {
    container = 'Refrigerated container';
    advice += ' Maintain cold chain and temperature monitoring.';
  }
  if (f.hazardous === 'yes') {
    name = 'Certified dangerous goods packaging';
    container = 'Specialized safety unit';
    advice += ' Add labeling, authorization, and safety documents.';
  }

  return { name, container, reason, advice };
}

function recommendVehicle(weightTons, f) {
  if (f.hazardous === 'yes') {
    return {
      name: 'Authorized ADR safety truck',
      capacity: 'Special regulated capacity',
      reason:
        'Hazardous goods require authorized vehicles and safety equipment.',
      safety: 'Authorization, labeling, and safety documents required.',
    };
  }

  if (f.refrigeration !== 'no') {
    return {
      name: 'Refrigerated truck',
      capacity: 'According to cold chain needs',
      reason: 'The shipment requires temperature-controlled transport.',
      safety: 'Monitor temperature during the full journey.',
    };
  }

  if (f.goodsType === 'Liquids' || f.liquid === 'yes') {
    return {
      name: 'Tanker truck or sealed container truck',
      capacity: 'Liquid cargo capacity',
      reason: 'Liquid goods require sealed transport to avoid leakage.',
      safety: 'Use anti-leak protection and secure loading.',
    };
  }

  if (f.goodsType === 'Construction materials') {
    return {
      name: 'Flatbed truck or semi-remorque',
      capacity: 'Heavy and large cargo',
      reason:
        'Construction materials require strong fixing and loading flexibility.',
      safety: 'Secure load with straps.',
    };
  }

  if (weightTons < 1) {
    return {
      name: 'Van / Fourgon',
      capacity: 'Up to 1 ton',
      reason: 'Suitable for small shipments.',
      safety: 'Basic load securing required.',
    };
  }
  if (weightTons <= 5) {
    return {
      name: 'Light rigid truck',
      capacity: '1 to 5 tons',
      reason: 'Suitable for medium loads.',
      safety: 'Check weight distribution.',
    };
  }
  if (weightTons <= 12) {
    return {
      name: '12-ton rigid truck',
      capacity: 'Up to 12 tons',
      reason:
        'Suitable capacity, lower fuel consumption, and flexible for road transport.',
      safety: 'Secure pallets and respect driver rest schedule.',
    };
  }
  if (weightTons <= 20) {
    return {
      name: 'Semi-remorque',
      capacity: '12 to 20 tons',
      reason: 'Suitable for heavy shipments and long distance.',
      safety: 'Strong load securing required.',
    };
  }
  return {
    name: 'Heavy semi-remorque',
    capacity: 'More than 20 tons',
    reason: 'Required for very heavy cargo.',
    safety: 'Special planning and safety checks required.',
  };
}

function getRisk(f, distance) {
  if (f.hazardous === 'yes' || f.fragility === 'high') return 'High';
  if (f.refrigeration !== 'no' || f.perishable === 'yes' || distance > 3500)
    return 'Medium';
  return 'Low';
}

function getSafetyNotes(f, distance) {
  const notes = [
    'Prepare transport and customs documents.',
    'Plan secure parking and rest stops.',
  ];
  if (f.fragility !== 'low')
    notes.push('Use shock protection and reinforced packaging.');
  if (f.perishable === 'yes')
    notes.push('Use fast delivery and hygiene control.');
  if (f.refrigeration !== 'no')
    notes.push('Maintain cold chain and temperature monitoring.');
  if (f.hazardous === 'yes')
    notes.push('Authorization, labeling, and safety documents required.');
  if (f.goodsType === 'Electronics')
    notes.push('Protect from humidity and shocks.');
  if (f.goodsType === 'Cosmetics') notes.push('Avoid heat exposure.');
  if (f.goodsType === 'Bottled water')
    notes.push('Use stable pallet loading and stretch film.');
  if (f.goodsType === 'Construction materials')
    notes.push('Secure the load with straps.');
  if (f.goodsType === 'Medicine')
    notes.push('Ensure documentation and temperature monitoring.');
  if (distance > 3500)
    notes.push('Long distance: plan fuel stops and overnight parking.');
  return notes;
}

export default App;
