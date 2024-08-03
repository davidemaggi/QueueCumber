using LiteDB;
using QueueCumber.Models.Entities;
using QueueCumber.Tools;
using System.Xml;

namespace QueueCumber.Data
{
    public class QueueCumberDataService: IQueueCumberDataService
    {
        private readonly SecurityService _security;
        private readonly FsService _fileSystem;
        public readonly LiteDatabase Context;
        private readonly string _dbPath;
        private readonly string _connString;

        public QueueCumberDataService(SecurityService ss, FsService fs) {
            _security = ss;
            _fileSystem = fs;
            _dbPath = Path.Combine(_fileSystem.GetAppFolder(),"QueueCumber.db");

            _connString = string.Format("Filename=\"{0}\";Password={1}", _dbPath, _security.GetUserSecret());

            try
            {
                var db = new LiteDatabase(_connString);
                if (db != null) {
                    Context = db;

                    Configure();
                }
            }
            catch (Exception ex)
            {
                throw new Exception("Can find or create QueueCumber database.", ex);
            }
            
        }


        private void Configure() {

            var mapper = BsonMapper.Global;

            mapper.Entity<QueueCumberConnection>()
                .Id(x => x.Id)
                //.Ignore(x => x.Status)
                ;


        }


        public ILiteDatabase GetContext() => Context;
    }
}
