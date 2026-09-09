from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from api.crud import full_delete_user
from api.models import User
from utilities.config import DatabaseEngineSettings, settings


def get_users(session: Session):
    users_query = select(User.uuid, User.email).where(User.email.contains("zaproxy"))
    return session.execute(users_query).all()


def delete_users(engine: Session, uuids: list[UUID]):
    for item in uuids:
        full_delete_user(session, item)


if __name__ == "__main__":
    db_settings = DatabaseEngineSettings.custom_timeout(30)
    engine = settings.get_write_engine(db_settings)
    with Session(engine) as session:
        response = get_users(session)
        uuids = [x[0] for x in response]
        delete_users(session, uuids)
