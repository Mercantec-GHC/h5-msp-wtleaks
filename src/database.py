from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

DATABASE_URL = "postgresql://Kasper:H5kode@10.133.51.104:5432/PostDB"

engine = create_engine(DATABASE_URL)

Sessionlocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine
)

Base = declarative_base()