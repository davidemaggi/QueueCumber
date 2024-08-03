using QueueCumber.Models.Entities;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace QueueCumber.Data.Repositories
{
    public class ConnectionRepository : BaseRepository<QueueCumberConnection>, IConnectionRepository
    {
        public ConnectionRepository(IQueueCumberDataService _queueCumberDataService) : base(_queueCumberDataService)
        { }



    }
}
