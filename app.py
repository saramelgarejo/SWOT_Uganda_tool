from flask import Flask, render_template, jsonify
import pandas as pd
from pathlib import Path
import geopandas as gpd
import os


app = Flask(__name__)

@app.route('/')
def index():
    return render_template('upper_victoria_nile_discharge.html')

@app.route('/dynamic_logic.js')
def dynamic_logic_script():
    
    return render_template('dynamic_logic.js'), 200, {'Content-Type': 'application/javascript'}

@app.route('/api/validation_data/<attribute>')
def get_validation_data(attribute):
    if attribute == 'Q_calc':
        
        file_path = 'static/discharge_results_17297100140431.csv'
        try:
            df = pd.read_csv(file_path)
            return jsonify({
                'dates': df['time'].tolist(),
                'values': df['Q_calc'].tolist()
            })
        except Exception as e:
            return jsonify({"error": str(e)}), 500

swot_folder = 'static/SWOT_Data'

@app.route('/api/swot_attribute/<reach_id>/<attribute>')
def get_swot_attribute(reach_id, attribute):
    all_data = []
    try:
        for root, dirs, files in os.walk(swot_folder):
            for file in files:
                if file.endswith(".shp"):
                    file_path = os.path.join(root, file)
                    gdf = gpd.read_file(file_path)
                    
                    
                    gdf['reach_clean'] = gdf["reach_id"].fillna(0).astype(float).astype(int).astype(str)
                    df_reach = gdf[gdf["reach_clean"] == str(reach_id)].copy()
                    
                    if not df_reach.empty:
                        if "reach_q" in df_reach.columns:
                            df_reach = df_reach[df_reach["reach_q"] <= 1].copy()
                        
                        if not df_reach.empty and attribute in df_reach.columns:
                            df_reach["date"] = pd.to_datetime(df_reach["time_str"], errors="coerce").dt.strftime('%Y-%m-%d')
                            df_reach = df_reach.dropna(subset=['date'])
                            daily_val = df_reach.groupby("date")[attribute].mean().reset_index()
                            all_data.append(daily_val)

        if not all_data:
            return jsonify({"error": "No valid data found"}), 404

        final_df = pd.concat(all_data).drop_duplicates().sort_values("date")
        return jsonify({
            "dates": final_df["date"].tolist(),
            "values": final_df[attribute].tolist()
        })
    except Exception as e:
        print(f"CRITICAL SERVER ERROR: {str(e)}")
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)