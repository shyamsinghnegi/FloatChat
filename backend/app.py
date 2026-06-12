

import re
import streamlit as st
import pandas as pd
import folium
import plotly.graph_objects as go
from plotly.subplots import make_subplots
from streamlit_folium import st_folium
from sqlalchemy import create_engine, text

from chat_with_data import hybrid_query
from config import DATABASE_URL, DB_POOL_SIZE, DB_MAX_OVERFLOW, DB_POOL_RECYCLE

# ── Page Config ───────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="FloatChat: Indian Ocean Explorer",
    page_icon="🌊",
    layout="wide"
)

# ── Database Connection ───────────────────────────────────────────────────────
# Using st.cache_resource so the connection pool is created once and
# shared across all user sessions, not recreated on every rerun.
@st.cache_resource
def get_engine():
    return create_engine(
        DATABASE_URL,
        pool_size=DB_POOL_SIZE,
        max_overflow=DB_MAX_OVERFLOW,
        pool_recycle=DB_POOL_RECYCLE,
        pool_pre_ping=True,   # Checks connection is alive before use
    )

engine = get_engine()

# ── Helper: Vertical Profile Chart ───────────────────────────────────────────
def plot_vertical_profiles(profile_id: str) -> go.Figure | None:
    """
    Generates a side-by-side depth chart: Temperature | Salinity.

    Fix from original:
    - SQL injection: now uses text() with bound parameters instead of
      f-string interpolation. profile_id from chat output is untrusted.
    - Only temperature was shown before. Now both parameters side by side.
    - Bare except: replaced with specific exception + st.warning.
    """
    try:
        query = text("""
            SELECT pressure, temperature, salinity
            FROM argo_readings
            WHERE profile_id = :pid
            ORDER BY pressure ASC
        """)
        df = pd.read_sql(query, engine, params={"pid": profile_id})

        if df.empty:
            return None

        fig = make_subplots(
            rows=1, cols=2,
            subplot_titles=("Temperature (°C)", "Salinity (PSU)"),
            shared_yaxes=True   # Same depth axis — makes comparison intuitive
        )

        # Temperature trace
        fig.add_trace(
            go.Scatter(
                x=df['temperature'], y=df['pressure'],
                mode='lines+markers',
                name='Temperature',
                line=dict(color='deepskyblue', width=2),
                marker=dict(size=3)
            ),
            row=1, col=1
        )

        # Salinity trace
        fig.add_trace(
            go.Scatter(
                x=df['salinity'], y=df['pressure'],
                mode='lines+markers',
                name='Salinity',
                line=dict(color='seagreen', width=2),
                marker=dict(size=3)
            ),
            row=1, col=2
        )

        fig.update_layout(
            title=f"Vertical Profile: {profile_id}",
            template="plotly_white",
            height=420,
            showlegend=False,
            margin=dict(t=60, b=20, l=10, r=10)
        )

        # Invert both y-axes — standard oceanographic convention
        # (deeper water = higher pressure = lower on the chart)
        fig.update_yaxes(autorange="reversed", title_text="Pressure (dbar)", col=1)
        fig.update_yaxes(autorange="reversed", col=2)
        fig.update_xaxes(title_text="Temperature (°C)", col=1)
        fig.update_xaxes(title_text="Salinity (PSU)", col=2)

        return fig

    except Exception as e:
        st.warning(f"Could not generate depth profile for {profile_id}: {e}")
        return None


# ── Helper: Named-column DataFrame from query result ─────────────────────────
def result_to_dataframe(result, sql: str) -> pd.DataFrame | None:
    """
    Convert a query result to a DataFrame with real column names.

    Fix from original:
    - pd.DataFrame(list_of_tuples) produces columns named 0, 1, 2.
    - We re-run the same SQL through SQLAlchemy's connection so we get
      the cursor's column names back, then apply them to the DataFrame.
    """
    if not isinstance(result, list) or len(result) == 0:
        return None

    try:
        with engine.connect() as conn:
            cursor_result = conn.execute(text(sql))
            columns = list(cursor_result.keys())

        df = pd.DataFrame(result, columns=columns)
        return df
    except Exception:
        # If column-name extraction fails, fall back to unnamed columns —
        # still better than crashing.
        return pd.DataFrame(result)


# ── Cached Data Fetchers ──────────────────────────────────────────────────────
@st.cache_data(ttl=300)  # Refresh every 5 minutes — not forever
def get_map_data() -> pd.DataFrame:
    return pd.read_sql(
        "SELECT profile_id, latitude, longitude, record_time "
        "FROM argo_profiles ORDER BY record_time ASC",
        engine
    )


@st.cache_data(ttl=300)
def get_header_stats() -> dict:
    row = pd.read_sql(
        "SELECT MIN(temperature) as min_t, MAX(temperature) as max_t, "
        "AVG(temperature) as avg_t FROM argo_readings",
        engine
    ).iloc[0]
    return row.to_dict()


# ── Load Data ─────────────────────────────────────────────────────────────────
df_path = get_map_data()
stats   = get_header_stats()

# ── Sidebar ───────────────────────────────────────────────────────────────────
with st.sidebar:
    st.header("🚢 Mission Control")
    st.info(f"Total Profiles: {len(df_path)}")
    st.info("Float: WMO 2903954")
    st.info("Region: Indian Ocean")

    st.divider()
    st.subheader("💡 Quick Research Queries")
    suggestions = [
        "How many total profiles are in the database?",
        "What is the average surface temperature for profile 2903954_5?",
        "Which profile has the highest average salinity?",
        "Show the location and date of all profiles",
        "What is the average temperature across all dives?",
        "Which profile was recorded furthest south?",
    ]
    for suggest in suggestions:
        if st.button(suggest, use_container_width=True):
            st.session_state.suggestion = suggest

# ── Main Layout ───────────────────────────────────────────────────────────────
st.title("🌊 FloatChat AI: ARGO Ocean Explorer")

# Header stats
s1, s2, s3, s4 = st.columns(4)
s1.metric("Mission Dives",     len(df_path))
s2.metric("Min Temp Recorded", f"{stats['min_t']:.2f}°C")
s3.metric("Max Temp Recorded", f"{stats['max_t']:.2f}°C")
s4.metric("Avg Temp (all)",    f"{stats['avg_t']:.2f}°C")

st.markdown("---")

col_map, col_chat = st.columns([1, 1])

# ── Map Column ────────────────────────────────────────────────────────────────
with col_map:
    st.subheader(f"📍 Float Trajectory ({len(df_path)} Dives)")

    center_lat = df_path['latitude'].mean()
    center_lon = df_path['longitude'].mean()
    m = folium.Map(
        location=[center_lat, center_lon],
        zoom_start=5,
        tiles="CartoDB positron"
    )

    path_coords = df_path[['latitude', 'longitude']].values.tolist()
    folium.PolyLine(path_coords, color="royalblue", weight=2.5, opacity=0.8).add_to(m)

    # All dive markers (small circles)
    for _, row in df_path.iterrows():
        folium.CircleMarker(
            location=[row['latitude'], row['longitude']],
            radius=3,
            color='royalblue',
            fill=True,
            fill_opacity=0.6,
            popup=folium.Popup(
                f"<b>{row['profile_id']}</b><br>{str(row['record_time'])[:10]}",
                max_width=200
            )
        ).add_to(m)

    # Start / end markers
    folium.Marker(
        path_coords[0],
        popup="START",
        icon=folium.Icon(color='green', icon='play')
    ).add_to(m)
    folium.Marker(
        path_coords[-1],
        popup="LATEST",
        icon=folium.Icon(color='red', icon='info-sign')
    ).add_to(m)

    st_folium(m, width="100%", height=500)

# ── Chat Column ───────────────────────────────────────────────────────────────
with col_chat:
    st.subheader("💬 AI Research Assistant")

    # Initialise session state
    if "messages" not in st.session_state:
        st.session_state.messages = []

    # Fix from original: chat input was defined BEFORE the container,
    # so it rendered above the chat history in the page. Now:
    # 1. Render history first.
    # 2. Input at the bottom.
    # 3. Spinner shown while the LLM is running.

    # ── Render chat history ───────────────────────────────────────────────────
    chat_container = st.container(height=440)
    with chat_container:
        for msg in st.session_state.messages:
            with st.chat_message(msg["role"]):
                st.markdown(msg["content"])
                if "df" in msg:
                    st.dataframe(msg["df"], use_container_width=True)
                if "plot" in msg:
                    st.plotly_chart(msg["plot"], use_container_width=True)

    # ── Chat input (at the bottom) ────────────────────────────────────────────
    chat_input = st.chat_input("Ask about ocean data...")

    # Sidebar suggestion takes priority over typed input
    prompt = st.session_state.pop("suggestion", None) or chat_input

    if prompt:
        # Add user message to history and display it
        st.session_state.messages.append({"role": "user", "content": prompt})

        with chat_container:
            with st.chat_message("user"):
                st.markdown(prompt)

            with st.chat_message("assistant"):
                # Show spinner while LLM is running — previously there was
                # no feedback and it looked like the app had frozen.
                with st.spinner("Thinking..."):
                    # Pass conversation history for follow-up question support
                    history_for_llm = [
                        {"role": m["role"], "content": m["content"]}
                        for m in st.session_state.messages[:-1]  # Exclude current question
                        if m["role"] in ("user", "assistant")
                    ]
                    result, sql_code = hybrid_query(
                        prompt,
                        chat_history=history_for_llm,
                        return_meta=True
                    )

                msg_data = {"role": "assistant"}

                # ── Render result ─────────────────────────────────────────────
                if not sql_code or "SELECT" not in sql_code.upper():
                    # Natural language response (no SQL was generated)
                    st.markdown(result)
                    msg_data["content"] = str(result)

                elif isinstance(result, list) and len(result) > 1:
                    # Tabular result — show with real column names
                    df_res = result_to_dataframe(result, sql_code)
                    if df_res is not None:
                        st.dataframe(df_res, use_container_width=True, height=200)
                        msg_data["content"] = f"Found {len(df_res)} rows."
                        msg_data["df"] = df_res
                    else:
                        st.markdown(str(result))
                        msg_data["content"] = str(result)

                else:
                    # Scalar / single-row result
                    st.markdown(f"**Result:** {result}")
                    msg_data["content"] = str(result)

                # Show the generated SQL in an expander for transparency
                if sql_code and "SELECT" in sql_code.upper():
                    with st.expander("🛠️ Generated SQL"):
                        st.code(sql_code, language="sql")

                # ── Auto depth profiles ───────────────────────────────────────
                # If a profile ID appears in the question or result,
                # show both temperature AND salinity profiles side by side.
                id_match = re.search(r'\b\d{7}_\d+\b', prompt + str(result))
                if id_match:
                    pid = id_match.group()
                    profile_fig = plot_vertical_profiles(pid)
                    if profile_fig:
                        st.divider()
                        st.plotly_chart(profile_fig, use_container_width=True)
                        msg_data["plot"] = profile_fig

        st.session_state.messages.append(msg_data)
        st.rerun()