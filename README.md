WaterWise Farm AI 🌱
A Weather-Aware Decision Support System for Irrigation Planning
WaterWise Farm AI is an experimental web-based prototype that combines historical weather analysis, live weather forecasts, and farmer-provided field observations to support irrigation planning.

The application presents transparent, rule-based outcomes to help users decide whether irrigation may need review, whether to wait and reassess, or whether more information is needed. It also provides historical data visualizations, daily screening results, scenario simulation, and an experiment that compares machine-learning forecasts of next-day reference evapotranspiration (ET₀) with a persistence baseline.
Important: WaterWise Farm AI is a prototype, not a validated agronomic recommendation system. Its results do not replace field measurements or advice from a qualified agricultural professional. It does not prescribe irrigation quantities, durations, or guaranteed schedules, and no field-validated water savings are claimed.

Table of Contents
- Project Objectives
- Key Features
- System Architecture
- Technology Stack
- Data Sources
- Historical Data Summary
- Machine Learning Experiment
- Irrigation Decision Outcomes
- Project Structure
- Installation and Setup
- Running the Application
- Using the Dashboard
- Limitations
- Future Enhancements
- Contributing
- License
Project Objectives
- Analyze historical weather variables such as temperature, relative humidity, rainfall, reference evapotranspiration, and estimated soil moisture.
- Handle missing observation dates transparently rather than treating missing data as zero.
- Integrate live weather forecasts using the Open-Meteo API.
- Combine forecast information with crop details and farmer-provided field observations.
- Generate understandable, rule-based irrigation review outcomes.
- Compare a Random Forest model with a persistence baseline for next-day ET₀ forecasting.
- Present historical analysis and current farm-check information through a web dashboard.
Key Features
- Overview dashboard: Summary statistics and historical screening results.
- Charts: Visual exploration of selected weather and irrigation-screening data.
- Daily Data: Searchable and filterable historical recommendations.
- Data Insights: Summary findings and data-quality information.
- Scenario Simulator: Test how different input conditions affect rule-based outcomes.
- Model Evaluation: Compare forecasting errors for the Random Forest model and baseline.
- Today's Farm Check: Enter a location manually or request browser location access, retrieve a weather forecast, and provide crop and field-observation details.
- Forecast freshness checks: The application flags stale or unavailable forecasts instead of presenting them as current.
- Transparent explanations: Results include explanations and suggested next steps rather than an automatic irrigation schedule.
System Architecture
Historical Dataset (CSV / Excel)
             |
             v
    Data Preprocessing
             |
             v
 Exploratory Data Analysis
             |
             v
 Historical Screening and
 Recommendation Data (CSV/JSON)
             |
             +--------------------------+
                                        |
Open-Meteo Weather Forecast API         |
             |                          |
             v                          v
      Live Weather Data ------> React Web Dashboard
                                        ^
                                        |
                          Farmer-Provided Field Inputs
                                        |
                                        v
                            Rule-Based Decision Engine

Historical Consecutive-Day Data
             |
             v
 Next-Day ET₀ Forecast Experiment
             |
             v
 Random Forest vs Persistence Baseline
             |
             v
       Model Evaluation
Technology Stack
Area	Technologies
Data analysis	Python, Pandas, NumPy
Machine learning	scikit-learn
Notebook environment	Google Colab / Jupyter
Frontend	React, Vite, JavaScript, HTML, CSS
Charts	Recharts
CSV parsing	Papa Parse
Icons	Lucide React
Weather data	Open-Meteo API
Location search / geocoding	OpenStreetMap Nominatim
Development tools	Visual Studio Code, npm, Git, GitHub


Data Sources
Historical dataset
- Dataset: AgriDataValue Pilot 18
- Repository: https://zenodo.org/records/18959383
- DOI: 10.5281/zenodo.18959383
The historical analysis uses weather and environmental data supplied in the project dataset, including weather-station and Open-Meteo-derived information.
Live weather forecasts
- Provider: Open-Meteo
- Documentation: https://open-meteo.com/en/docs
The application requests forecast data for the selected location. Forecast values are estimates and may differ from other weather providers because of differences in models, coordinates, and update times.
Location lookup
- Provider: OpenStreetMap Nominatim
- Documentation: https://nominatim.org/release-docs/latest/api/Overview/
Location lookup and browser geolocation depend on network access, browser permissions, and the availability and accuracy of location services. Manual location entry is available as an alternative.
Historical Data Summary
The prepared daily dataset contains 355 observed daily records spanning 2024-03-29 to 2025-10-02.
Measure	Project result
Observed daily records	355
Calendar dates in the overall period	553
Calendar dates without observations	198
Average temperature	20.43 °C
Average relative humidity	59.95%
Average reference evapotranspiration (ET₀)	4.70 mm/day
Total recorded rainfall in the analyzed data	434.5 mm


The source period includes missing calendar dates and a long gap between observed dates. Missing days are not automatically interpreted as days with zero rainfall or zero evapotranspiration.
Historical screening outcomes
The current historical screening rules produced the following counts across 355 observed records:
Screening outcome	Records
Monitor - lower ET0	183
Review - moisture not relatively low	66
Potential irrigation review	61
Review rainfall before irrigation	45
Total	355


These labels are preliminary screening categories based on project-defined rules. They are not independently validated irrigation recommendations.
Machine Learning Experiment
The project includes an experiment to forecast next-day reference evapotranspiration (ET₀). It compares a Random Forest Regressor against a persistence baseline, which predicts that the next day's ET₀ will equal the current day's value.

Only consecutive-date pairs were used. The experiment used a chronological 80/20 split, with 282 training pairs and 71 test pairs.
Model	MAE (mm/day)	RMSE (mm/day)
Persistence baseline	0.856	1.187
Random Forest Regressor	0.941	1.190


Interpretation: The persistence baseline performed better than the Random Forest model on this test split. Therefore, the project does not claim that machine learning currently improves forecast accuracy. ET₀ is reference evapotranspiration; it is not the same as crop-specific evapotranspiration or the exact amount of irrigation a field needs.
Irrigation Decision Outcomes
The live farm-check feature returns one of three outcomes:
1. Irrigation may need review — the entered field observations and forecast signals suggest that the user should review the situation.
2. Wait and reassess — the available information supports checking conditions again rather than making an immediate decision.
3. More information needed — required information is missing, uncertain, invalid, or the forecast is stale/unavailable.
The decision engine considers the selected crop, crop age, last irrigation date and time, observed soil condition, optional recent rainfall, and available forecast information. It does not calculate or prescribe a guaranteed irrigation quantity, duration, or schedule. Forecast rainfall probability and forecast precipitation amount are treated as separate signals.
Project Structure
The repository may be organized as follows. Adjust names to match the files actually committed to your GitHub repository.
WaterWise-Farm-AI/
├── notebooks/                       # Historical analysis and ML experiments
├── waterwise_data/                  # Prepared datasets and analysis outputs
├── waterwise-dashboard/
│   ├── public/
│   │   └── data/
│   │       ├── waterwise_daily_recommendations.csv
│   │       └── waterwise_dashboard_summary.json
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── ...
│   ├── package.json
│   └── vite.config.js
└── README.md
This is an illustrative structure, not a guarantee that every folder or file exists in your repository. Update it after checking the actual project files. Do not commit API secrets, private credentials, or unnecessary large raw datasets.

Installation and Setup
Prerequisites
- Node.js and npm
- Git
- A modern web browser
- Internet connection for live weather and location lookup
1. Clone the repository
Replace the placeholder with your actual GitHub repository URL.
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd <YOUR_REPOSITORY_FOLDER>
2. Open the frontend directory
cd waterwise-dashboard
If your frontend folder has a different name, use its actual path.
3. Install dependencies
npm install
The project uses React and Vite, with Recharts, Papa Parse, and Lucide React for charting, CSV parsing, and icons.
Running the Application
Start the development server from the frontend directory:
npm run dev
Open the local URL printed in the terminal, commonly:
http://localhost:5173/
To create a production build:
npm run build
To run the project's configured lint checks:
npm run lint
A lint command may report issues in existing files; review the output rather than assuming every check passes.
Using the Dashboard
1. Open the application in your browser.
2. Visit Overview to see the historical summary.
3. Use Charts and Daily Data to explore the prepared observations and screening results.
4. Open Data Insights to review the analysis and data limitations.
5. Use Scenario Simulator to test example conditions.
6. Open Model Evaluation to compare forecasting errors.
7. Go to Today's Farm Check.
8. Enter a location manually or allow location access if you choose.
9. Fetch the weather forecast and enter the crop details, last irrigation date/time, and observed soil condition.
10. Read the outcome and explanation. If the forecast is stale, unavailable, or the inputs are insufficient, refresh the forecast or provide the missing information before interpreting the result.
Limitations
- The system is an experimental prototype and has not been validated through field trials.
- The historical dataset contains 198 calendar dates without observations, including a long gap. Results apply to observed records, not a complete uninterrupted daily series.
- Soil-moisture values are modeled estimates and may not represent calibrated measurements from the user's field.
- The soil texture and several field-specific agronomic parameters are not fully known.
- ET₀ is a reference measure, not a direct estimate of crop water requirement or irrigation volume. Crop stage, crop coefficient, effective rainfall, root-zone characteristics, and irrigation efficiency would need appropriate data and validation.
- Weather forecasts are uncertain and may differ between providers.
- The current rules are project-defined and have not been validated by agronomists or through field measurements.
- The Random Forest experiment did not outperform the persistence baseline on the reported test split.
- The project does not claim measured water savings, improved crop yield, or validated irrigation performance.
Future Enhancements
- Validate the decision rules with agricultural experts and field trials.
- Add calibrated soil-moisture sensor readings and field-specific soil information.
- Improve crop-stage and crop-coefficient handling with appropriate references.
- Evaluate additional forecasting approaches using chronological validation.
- Improve handling of missing observations and monitor data-source quality.
- Collect real irrigation actions and outcomes for evaluation.
- Add user accounts, farm profiles, and mobile-friendly features if needed.
- Evaluate practical outcomes such as water use and crop response before making impact claims.
Contributing
Contributions and suggestions are welcome.
1. Fork the repository.
2. Create a feature branch.
3. Make and test your changes.
4. Submit a pull request describing the change.
Please document new assumptions, data sources, and rule changes clearly.
