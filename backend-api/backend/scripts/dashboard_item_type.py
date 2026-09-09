import argparse
import gzip
import json
from collections.abc import Callable

from sqlalchemy import text
from sqlalchemy.orm import Session

from utilities.config import DatabaseEngineSettings, settings


def run_migration(session: Session, convert: Callable):
    select_query = "select uuid, content from dashboard_item"
    result = session.execute(text(select_query)).all()
    update_query = text("UPDATE dashboard_item SET temp_content = :temp_content WHERE uuid = :uuid")
    for uuid, content in result:
        session.execute(update_query, {"temp_content": convert(content), "uuid": uuid})
    session.commit()


def gzip_to_json(session: Session):
    """
    This function requires that the dashboard_item table has the following columns:
        - content: MediumBlob where bytes represent the gzipped data
        - temp_content: JSON

    Steps for success:
        1. SQL: ALTER TABLE dashboard_item ADD temp_content JSON;
        2. SHELL: python -m scripts.dashboard_item_type --reverse
        3. SQL: ALTER TABLE dashboard_item RENAME COLUMN content TO old_content;
        4. SQL: ALTER TABLE dashboard_item RENAME COLUMN temp_content TO content;
        5. MANUALLY: confirm the new data works successfully
        6. SQL: ALTER TABLE dashboard_item DROP COLUMN old_content;
    """

    def convert(data: None | bytes) -> None | str:
        if data is None:
            return None
        return gzip.decompress(data).decode("utf-8")

    run_migration(session, convert)


def json_to_gzip(session: Session):
    """
    This function requires that the dashboard_item table has the following columns:
        - content: JSON
        - temp_content: MediumBlob

    Steps for success:
        1. SQL: ALTER TABLE dashboard_item ADD temp_content MEDIUMBLOB;
        2. SHELL: python -m scripts.dashboard_item_type
        3. SQL: ALTER TABLE dashboard_item RENAME COLUMN content TO old_content;
        4. SQL: ALTER TABLE dashboard_item RENAME COLUMN temp_content TO content;
        5. MANUALLY: confirm the new data works successfully
        6. SQL: ALTER TABLE dashboard_item DROP COLUMN old_content;
    """

    def convert(data: None | dict | str) -> None | bytes:
        if data is None:
            return None
        as_str = json.dumps(data) if isinstance(data, dict) else data
        return gzip.compress(as_str.encode("utf-8"))

    run_migration(session, convert)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    help_text = "Move from gzip to json instead of json to gzip"
    parser.add_argument("--reverse", action="store_true", help=help_text)
    args = parser.parse_args()

    db_settings = DatabaseEngineSettings.custom_timeout(30)
    engine = settings.get_write_engine(db_settings)
    with Session(engine) as session:
        if args.reverse:
            gzip_to_json(session)
        else:
            json_to_gzip(session)
