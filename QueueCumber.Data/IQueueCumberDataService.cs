using LiteDB;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace QueueCumber.Data
{
    public interface IQueueCumberDataService
    {
        public ILiteDatabase GetContext();



    }
}
